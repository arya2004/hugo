import { FundingControls } from '../../../../../components/funding-controls';
import { Private } from '../../../../../components/private';
import { ProjectHeading } from '../../../../../components/project-client';

export default async function Settings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Private programId={id}>
      <ProjectHeading id={id} section="settings" />
      <FundingControls id={id} />
    </Private>
  );
}
