import { User, Mail, Phone, Building } from "lucide-react";

interface PersonalInformationCardProps {
  profile: any;
  isEditing: boolean;
  editData: any;
  saveError: string | null;
  onInputChange: (field: string, value: string) => void;
}

export const PersonalInformationCard = ({
  profile,
  isEditing,
  editData,
  saveError,
  onInputChange,
}: PersonalInformationCardProps) => (
  <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center">
      <User className="mr-2 h-5 w-5 text-blue-600" />
      <h2 className="text-lg font-semibold text-gray-900">
        Personal Information
      </h2>
    </div>

    {saveError && (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{saveError}</p>
      </div>
    )}

    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Full Name
        </label>
        {isEditing ? (
          <input
            type="text"
            value={editData.name || ""}
            onChange={(e) => onInputChange("name", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <p className="py-2 text-gray-900">{profile.name || "Not provided"}</p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Email Address
        </label>
        <div className="flex items-center py-2 text-gray-900">
          <Mail className="mr-2 h-4 w-4 text-gray-400" />
          {profile.email || "Not provided"}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Phone Number
        </label>
        {isEditing ? (
          <input
            type="tel"
            value={editData.phone || ""}
            onChange={(e) => onInputChange("phone", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="flex items-center py-2 text-gray-900">
            <Phone className="mr-2 h-4 w-4 text-gray-400" />
            {profile.phone || "Not provided"}
          </div>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Company Name
        </label>
        {isEditing ? (
          <input
            type="text"
            value={editData.company_name || ""}
            onChange={(e) => onInputChange("company_name", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="flex items-center py-2 text-gray-900">
            <Building className="mr-2 h-4 w-4 text-gray-400" />
            {profile.company_name || "Not provided"}
          </div>
        )}
      </div>
    </div>
  </div>
);
