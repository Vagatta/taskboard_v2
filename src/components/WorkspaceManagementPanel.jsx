import WorkspaceSelector from './WorkspaceSelector';

// Panel sencillo para agrupar toda la gestión de workspaces en un solo sitio.
export default function WorkspaceManagementPanel({
  user,
  selectedWorkspaceId,
  onSelect,
  onWorkspacesChange,
  onWorkspaceMembersChange
}) {
  return (
    <div className="space-y-6">
      <WorkspaceSelector
        user={user}
        selectedWorkspaceId={selectedWorkspaceId}
        onSelect={onSelect}
        onWorkspacesChange={onWorkspacesChange}
        onWorkspaceMembersChange={onWorkspaceMembersChange}
      />
    </div>
  );
}
