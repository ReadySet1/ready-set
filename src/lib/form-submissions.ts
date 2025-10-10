// src/lib/form-submissions.ts
import { prisma } from "@/utils/prismaDB";
import { DeliveryFormData, FormType, } from "@/components/Logistics/QuoteRequest/types";
import { v4 as uuidv4 } from "uuid";
const normalizeValue = (value: any): string => {
    if (Array.isArray(value)) {
        return value.join(", ");
    }
    if (value === null || value === undefined || value === "") {
        return "N/A";
    }
    return String(value);
};
export class FormSubmissionService {
    static async createSubmission(data: {
        formType: FormType;
        formData: DeliveryFormData;
    }) {
        if (!data.formType) {
            throw new Error("Form type is required");
        }
        try {
            // Extract base fields and specifications
            const { companyName, contactName, email, phone, website, counties, additionalComments, pickupAddress, ...specifications } = data.formData;
            const submission = await prisma.formSubmission.create({
                data: {
                    id: uuidv4(),
                    updatedAt: new Date(),
                    formType: data.formType.toUpperCase() as any, // Convert to uppercase to match enum
                    companyName: normalizeValue(companyName),
                    contactName: normalizeValue(contactName),
                    email: normalizeValue(email),
                    phone: normalizeValue(phone),
                    website: normalizeValue(website),
                    counties: Array.isArray(counties) ? counties : [],
                    frequency: "frequency" in specifications ? specifications.frequency : "N/A",
                    pickupAddress: pickupAddress || {
                        street: "",
                        city: "",
                        state: "",
                        zip: "",
                    },
                    additionalComments: normalizeValue(additionalComments),
                    specifications: JSON.stringify(specifications),
                },
            });
            return submission;
        }
        catch (error) {
            console.error("Error in form submission:", error);
            throw error;
        }
    }
}
