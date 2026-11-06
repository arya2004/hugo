import Link from 'next/link';
import { ProjectList } from '../../components/project-client';

export default function Admin() {
  return (
    <>
      <div className="pagehead">
        <span className="eyebrow">ADMIN / REPOSITORY OWNER</span>
        <h1>Your repositories.</h1>
        <p>One repository. One permanent funding address. One maximum reward setting.</p>
        <Link className="button primary" href="/admin/projects/new">
          Register repository ↗
        </Link>
      </div>
      <ProjectList />
    </>
  );
}
