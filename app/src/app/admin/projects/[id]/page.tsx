import { Private } from '../../../../components/private';
import { ProjectHeading, ProjectFunding } from '../../../../components/project-client';

export default async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Private programId={id}>
      <ProjectHeading id={id} section="funding" />
      <ProjectFunding id={id} />
    </Private>
  );
}
