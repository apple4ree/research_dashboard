import { getMembersByProject, getAllMembers } from '@/lib/queries';
import { loadProject } from '@/lib/mock/loaders';
import { ProjectMembersView } from '@/components/project/ProjectMembersView';

export default async function MembersTab({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await loadProject(params);
  const [members, allMembers] = await Promise.all([
    getMembersByProject(slug),
    getAllMembers(),
  ]);
  const memberSet = new Set(members.map(m => m.login));
  const candidates = allMembers.filter(m => !memberSet.has(m.login));

  return (
    <ProjectMembersView
      projectSlug={slug}
      members={members}
      candidates={candidates}
    />
  );
}
