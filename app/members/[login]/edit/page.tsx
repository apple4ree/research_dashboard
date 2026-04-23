import { notFound } from 'next/navigation';
import { MemberForm } from '@/components/people/MemberForm';
import { getMemberByLogin, getAllProjects } from '@/lib/queries';

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ login: string }>;
}) {
  const { login } = await params;
  const [member, projects] = await Promise.all([getMemberByLogin(login), getAllProjects()]);
  if (!member) notFound();

  return <MemberForm mode="edit" projects={projects} initial={member} />;
}
