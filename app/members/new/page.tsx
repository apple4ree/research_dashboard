import { MemberForm } from '@/components/people/MemberForm';
import { getAllProjects } from '@/lib/queries';

export default async function NewMemberPage() {
  const projects = await getAllProjects();
  return <MemberForm mode="create" projects={projects} />;
}
