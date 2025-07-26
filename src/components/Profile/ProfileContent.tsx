import { PersonalInformationCard } from "./PersonalInformationCard";
import { AddressInformationCard } from "./AddressInformationCard";
import { AccountStatusCard } from "./AccountStatusCard";
import { AccountTimelineCard } from "./AccountTimelineCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { ProfileHeader } from "./ProfileHeader";
import { Button } from "@/components/ui/button";
import { Save, X } from "lucide-react";

interface ProfileContentProps {
  profile: any;
  isEditing: boolean;
  editData: any;
  saving: boolean;
  saveError: string | null;
  onEditToggle: () => void;
  onInputChange: (field: string, value: string) => void;
  onSave: () => void;
}

export const ProfileContent = ({
  profile,
  isEditing,
  editData,
  saving,
  saveError,
  onEditToggle,
  onInputChange,
  onSave,
}: ProfileContentProps) => (
  <div className="min-h-screen bg-gray-50">
    <div className="container mx-auto px-4 py-32">
      <ProfileHeader
        profile={profile}
        isEditing={isEditing}
        saving={saving}
        onEditToggle={onEditToggle}
      />

      {/* Edit Mode Actions */}
      {isEditing && (
        <div className="mb-6 flex justify-end space-x-4">
          <Button
            onClick={onEditToggle}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Content - Main Profile Info */}
        <div className="space-y-6 lg:col-span-2">
          <PersonalInformationCard
            profile={profile}
            isEditing={isEditing}
            editData={editData}
            saveError={saveError}
            onInputChange={onInputChange}
          />
          <AddressInformationCard
            profile={profile}
            isEditing={isEditing}
            editData={editData}
            onInputChange={onInputChange}
          />
        </div>

        {/* Right Content - Sidebar */}
        <div className="space-y-6">
          <AccountStatusCard profile={profile} />
          <AccountTimelineCard />
          <QuickActionsCard />
        </div>
      </div>
    </div>
  </div>
); 