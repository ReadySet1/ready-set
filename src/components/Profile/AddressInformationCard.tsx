import { MapPin } from "lucide-react";

interface AddressInformationCardProps {
  profile: any;
  isEditing: boolean;
  editData: any;
  onInputChange: (field: string, value: string) => void;
}

export const AddressInformationCard = ({
  profile,
  isEditing,
  editData,
  onInputChange,
}: AddressInformationCardProps) => (
  <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center">
      <MapPin className="mr-2 h-5 w-5 text-blue-600" />
      <h2 className="text-lg font-semibold text-gray-900">
        Address Information
      </h2>
    </div>

    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Street Address
        </label>
        {isEditing ? (
          <input
            type="text"
            value={editData.street_address || ""}
            onChange={(e) => onInputChange("street_address", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <p className="py-2 text-gray-900">
            {profile.street_address || "Not provided"}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Street Address 2
        </label>
        {isEditing ? (
          <input
            type="text"
            value={editData.street_address_2 || ""}
            onChange={(e) => onInputChange("street_address_2", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <p className="py-2 text-gray-900">
            {profile.street_address_2 || "Not provided"}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          City
        </label>
        {isEditing ? (
          <input
            type="text"
            value={editData.city || ""}
            onChange={(e) => onInputChange("city", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <p className="py-2 text-gray-900">
            {profile.city || "Not provided"}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          State
        </label>
        {isEditing ? (
          <input
            type="text"
            value={editData.state || ""}
            onChange={(e) => onInputChange("state", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <p className="py-2 text-gray-900">
            {profile.state || "Not provided"}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          ZIP Code
        </label>
        {isEditing ? (
          <input
            type="text"
            value={editData.zip_code || ""}
            onChange={(e) => onInputChange("zip_code", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <p className="py-2 text-gray-900">
            {profile.zip_code || "Not provided"}
          </p>
        )}
      </div>
    </div>
  </div>
); 