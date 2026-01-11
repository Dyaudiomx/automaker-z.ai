import { Button } from '@/components/ui/button';
import { HotkeyButton } from '@/components/ui/hotkey-button';
import { UserCircle, Plus, RefreshCw } from 'lucide-react';

interface ProfilesHeaderProps {
  onResetProfiles: () => void;
  onAddProfile: () => void;
  addProfileHotkey: string;
}

export function ProfilesHeader({
  onResetProfiles,
  onAddProfile,
  addProfileHotkey,
}: ProfilesHeaderProps) {
  return (
    <div className="shrink-0 border-b border-border bg-glass backdrop-blur-md">
      <div className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/20 flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI Profiles</h1>
              <p className="text-sm text-muted-foreground">
                Create and manage model configuration presets
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onResetProfiles}
              data-testid="refresh-profiles-button"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Defaults
            </Button>
            <HotkeyButton
              onClick={onAddProfile}
              hotkey={addProfileHotkey}
              hotkeyActive={false}
              data-testid="add-profile-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Profile
            </HotkeyButton>
          </div>
        </div>
      </div>
    </div>
  );
}
