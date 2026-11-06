// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Testnet repository treasury. Identity and evidence verification trust the signer.
contract ContributionTreasury is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public immutable administrator;
    bytes32 public immutable repositoryKey;
    address public immutable rewardSigner;
    uint256 public immutable maxRewardMicro;
    uint256 public available;
    uint256 public reserved;
    bool public fundingActive;

    struct Transition {
        uint64 timestamp;
        bool active;
    }
    struct Reward {
        uint256 amount;
        uint256 remaining;
        bytes32 reportHash;
        uint64 mergedAt;
    }
    struct Allocation {
        bytes32 mergeId;
        uint256 amount;
    }
    struct Claim {
        bytes32 mergeId;
        bytes32 claimId;
        bytes32 reportHash;
        address recipient;
        uint256 amount;
        uint64 deadline;
    }

    Transition[] public fundingTransitions;
    mapping(bytes32 => Reward) public rewards;
    mapping(bytes32 => Allocation) public allocations;
    mapping(bytes32 => bool) public claimUsed;
    bytes32 private constant CLAIM_TYPEHASH = keccak256(
        "Claim(bytes32 mergeId,bytes32 claimId,bytes32 reportHash,address recipient,uint256 amount,uint64 deadline)"
    );

    event ProjectFunded(address indexed donor, uint256 amount);
    event FundingStateChanged(bool active, uint64 effectiveAt);
    event RewardReserved(bytes32 indexed mergeId, uint256 amount, bytes32 reportHash);
    event RewardClaimed(
        bytes32 indexed mergeId,
        bytes32 indexed claimId,
        address recipient,
        uint256 amount
    );
    error Unauthorized();
    error InvalidInput();
    error AlreadyExists();
    error InsufficientAvailable();
    error InvalidVoucher();
    error AlreadyClaimed();
    error Expired();

    constructor(
        address token,
        bytes32 repo,
        address signer,
        uint256 maximum
    ) EIP712("ProofOfContribution", "2") {
        if (
            token == address(0) ||
            repo == bytes32(0) ||
            signer == address(0) ||
            signer == msg.sender ||
            maximum == 0
        ) {
            revert InvalidInput();
        }
        usdc = IERC20(token);
        administrator = msg.sender;
        repositoryKey = repo;
        rewardSigner = signer;
        maxRewardMicro = maximum;
        fundingTransitions.push(Transition(uint64(block.timestamp), false));
        emit FundingStateChanged(false, uint64(block.timestamp));
    }

    function setFundingActive(bool active) external {
        if (msg.sender != administrator) {
            revert Unauthorized();
        }
        if (active == fundingActive) {
            revert InvalidInput();
        }
        fundingActive = active;
        fundingTransitions.push(Transition(uint64(block.timestamp), active));
        emit FundingStateChanged(active, uint64(block.timestamp));
    }

    /// @dev Intervals are [start, stop). Last transition wins for identical timestamps.
    function fundingAt(uint64 timestamp) public view returns (bool) {
        uint256 low;
        uint256 high = fundingTransitions.length;
        while (low < high) {
            uint256 middle = (low + high) / 2;
            if (fundingTransitions[middle].timestamp <= timestamp) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }
        return low > 0 && fundingTransitions[low - 1].active;
    }

    function fund(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert InvalidInput();
        }
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        available += amount;
        emit ProjectFunded(msg.sender, amount);
    }

    function reserveReward(
        bytes32 mergeId,
        uint64 mergedAt,
        bytes32 reportHash,
        bytes32[] calldata claimIds,
        uint256[] calldata amounts
    ) external {
        if (msg.sender != rewardSigner) {
            revert Unauthorized();
        }
        if (
            mergeId == bytes32(0) ||
            reportHash == bytes32(0) ||
            mergedAt > block.timestamp ||
            !fundingAt(mergedAt) ||
            claimIds.length == 0 ||
            claimIds.length > 30 ||
            claimIds.length != amounts.length
        ) {
            revert InvalidInput();
        }
        if (rewards[mergeId].amount != 0) {
            revert AlreadyExists();
        }
        uint256 total;
        for (uint256 i; i < claimIds.length; ++i) {
            if (
                claimIds[i] == bytes32(0) ||
                amounts[i] == 0 ||
                allocations[claimIds[i]].amount != 0
            ) {
                revert InvalidInput();
            }
            allocations[claimIds[i]] = Allocation(mergeId, amounts[i]);
            total += amounts[i];
        }
        if (total > maxRewardMicro) {
            revert InvalidInput();
        }
        if (total > available) {
            revert InsufficientAvailable();
        }
        available -= total;
        reserved += total;
        rewards[mergeId] = Reward(total, total, reportHash, mergedAt);
        emit RewardReserved(mergeId, total, reportHash);
    }

    /// @dev A relayer may submit; signatures bind the exact allocation and recipient.
    function claim(Claim calldata c, bytes calldata signature) external nonReentrant {
        if (claimUsed[c.claimId]) {
            revert AlreadyClaimed();
        }
        if (block.timestamp > c.deadline) {
            revert Expired();
        }
        Reward storage reward = rewards[c.mergeId];
        Allocation storage allocation = allocations[c.claimId];
        if (
            c.recipient == address(0) ||
            allocation.amount == 0 ||
            allocation.mergeId != c.mergeId ||
            c.amount != allocation.amount ||
            c.reportHash != reward.reportHash ||
            c.amount > reward.remaining
        ) {
            revert InvalidVoucher();
        }
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CLAIM_TYPEHASH,
                    c.mergeId,
                    c.claimId,
                    c.reportHash,
                    c.recipient,
                    c.amount,
                    c.deadline
                )
            )
        );
        if (ECDSA.recover(digest, signature) != rewardSigner) {
            revert InvalidVoucher();
        }
        claimUsed[c.claimId] = true;
        reward.remaining -= c.amount;
        reserved -= c.amount;
        usdc.safeTransfer(c.recipient, c.amount);
        emit RewardClaimed(c.mergeId, c.claimId, c.recipient, c.amount);
    }
}
