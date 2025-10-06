import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface AddressFormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

const AddressFormSection: React.FC<AddressFormSectionProps> = ({
  title,
  description,
  children,
  className = "",
}) => {
  return (
    <Card className={`border-gray-200 dark:border-gray-700 ${className}`}>
      <CardContent className="pt-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        <div className="space-y-4">{children}</div>
      </CardContent>
    </Card>
  );
};

export default AddressFormSection;
