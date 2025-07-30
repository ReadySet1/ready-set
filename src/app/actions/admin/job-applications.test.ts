import { prisma } from '@/lib/db/prisma';
import { approveJobApplication } from './job-applications';
import { UserType } from "@/types/user";
import { ApplicationStatus } from "@/types/prisma";

// Mock next/cache
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
    prisma: {
        jobApplication: {
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
        },
        user: {
            create: jest.fn(),
        },
    },
}));

describe('Job Applications', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('approveJobApplication', () => {
        it('should approve a driver application successfully', async () => {
            // Mock data
            const mockApplication = {
                id: 'test-id',
                firstName: 'Test',
                lastName: 'DriverApp',
                email: 'test.driver.applicant@example.com',
                position: 'Driver for Delivery',
                addressStreet: '123 Test St',
                addressCity: 'Testville',
                addressState: 'TS',
                addressZip: '12345',
                education: 'Some School',
                workExperience: 'Some Experience',
                skills: 'Driving Safely',
                resumeFilePath: 'resume.pdf',
                status: ApplicationStatus.PENDING,
            };

            const mockUser = {
                id: 'user-id',
                email: 'test.driver.applicant@example.com',
                type: UserType.DRIVER,
            };

            // Setup mocks
            (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue(mockApplication);
            (prisma.jobApplication.update as jest.Mock).mockResolvedValue({
                ...mockApplication,
                status: ApplicationStatus.APPROVED,
            });
            (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

            // Execute
            const result = await approveJobApplication('test-id');

            // Assert
            expect(result).toBeDefined();
            expect(prisma.jobApplication.update).toHaveBeenCalledWith({
                where: { id: 'test-id' },
                data: { status: ApplicationStatus.APPROVED },
            });
        });

        it('should approve a helpdesk application successfully', async () => {
            // Mock data
            const mockApplication = {
                id: 'test-id',
                firstName: 'Test',
                lastName: 'Helper',
                email: 'helpdesk.applicant@example.com',
                position: 'Virtual Assistant - Helpdesk Support',
                addressStreet: '456 Desk St',
                addressCity: 'Supportville',
                addressState: 'SP',
                addressZip: '67890',
                education: 'Associate Degree',
                workExperience: 'Customer Service',
                skills: 'Typing, Communication',
                resumeFilePath: 'resume_help.pdf',
                status: ApplicationStatus.PENDING,
            };

            const mockUser = {
                id: 'user-id',
                email: 'helpdesk.applicant@example.com',
                type: UserType.HELPDESK,
            };

            // Setup mocks
            (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue(mockApplication);
            (prisma.jobApplication.update as jest.Mock).mockResolvedValue({
                ...mockApplication,
                status: ApplicationStatus.APPROVED,
            });
            (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

            // Execute
            const result = await approveJobApplication('test-id');

            // Assert
            expect(result).toBeDefined();
            expect(prisma.jobApplication.update).toHaveBeenCalledWith({
                where: { id: 'test-id' },
                data: { status: ApplicationStatus.APPROVED },
            });
        });

        it('should handle application not found', async () => {
            // Setup mocks
            (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue(null);

            // Execute and assert
            await expect(approveJobApplication('non-existent-id')).rejects.toThrow('Application not found');
        });
    });
});