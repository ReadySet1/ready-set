import { prisma } from '@/lib/db/prisma';
import { approveJobApplication } from './job-applications';
import { UserType } from "@/types/user";
import { ApplicationStatus } from "@/types/prisma";
import { createClient } from '@/utils/supabase/server';

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
        profile: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
        $transaction: jest.fn((callback) => callback({
            profile: {
                create: jest.fn(),
            },
            jobApplication: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
        })),
    },
}));

// Mock Supabase server
jest.mock('@/utils/supabase/server');
const mockCreateClient = createClient as jest.Mock;

describe('Job Applications', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default: user is an approver (e.g., type: 'ADMIN')
        mockCreateClient.mockReturnValue({
            auth: {
                getSession: jest.fn().mockResolvedValue({
                    data: { session: { access_token: 'mock-token' } },
                    error: null,
                }),
                getUser: jest.fn().mockResolvedValue({
                    data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
                    error: null,
                }),
            },
            from: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn(() => ({
                    single: jest.fn().mockResolvedValue({
                        data: { type: 'ADMIN' }, // Default user type
                        error: null,
                    }),
                    data: [{ type: 'ADMIN' }],
                    error: null,
                })),
            })),
        });
    });

    describe('approveJobApplication', () => {
        it('should approve a driver application successfully', async () => {
            // Override mock to use admin user type for this test
            mockCreateClient.mockReturnValueOnce({
                auth: {
                    getSession: jest.fn().mockResolvedValue({
                        data: { session: { access_token: 'mock-token' } },
                        error: null,
                    }),
                    getUser: jest.fn().mockResolvedValue({
                        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
                        error: null,
                    }),
                },
                from: jest.fn(() => ({
                    select: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockReturnThis(),
                    update: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockReturnThis(),
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: { type: 'ADMIN' }, // Admin can approve driver applications
                            error: null,
                        }),
                        data: [{ type: 'ADMIN' }],
                        error: null,
                    })),
                })),
            });

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
            (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null); // No existing profile
            (prisma.profile.create as jest.Mock).mockResolvedValue({ id: 'profile-id' });
            
            // Mock the transaction to return the job application when findUnique is called
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                const mockTx = {
                    profile: {
                        create: jest.fn().mockResolvedValue({ id: 'profile-id' }),
                    },
                    jobApplication: {
                        findUnique: jest.fn().mockResolvedValue(mockApplication), // Return the application
                        update: jest.fn().mockResolvedValue({
                            ...mockApplication,
                            status: ApplicationStatus.APPROVED,
                        }),
                    },
                };
                return await callback(mockTx);
            });

            // Execute
            const result = await approveJobApplication('test-id');

            // Assert
            expect(result).toBeDefined();
            // The function uses the transaction's update method, not the main prisma client
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('should approve a helpdesk application successfully', async () => {
            // Override mock to use helpdesk user type for this test
            mockCreateClient.mockReturnValueOnce({
                auth: {
                    getSession: jest.fn().mockResolvedValue({
                        data: { session: { access_token: 'mock-token' } },
                        error: null,
                    }),
                    getUser: jest.fn().mockResolvedValue({
                        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
                        error: null,
                    }),
                },
                from: jest.fn(() => ({
                    select: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockReturnThis(),
                    update: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockReturnThis(),
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: { type: 'HELPDESK' }, // Helpdesk user can approve helpdesk applications
                            error: null,
                        }),
                        data: [{ type: 'HELPDESK' }],
                        error: null,
                    })),
                })),
            });

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
            (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null); // No existing profile
            (prisma.profile.create as jest.Mock).mockResolvedValue({ id: 'profile-id' });
            
            // Mock the transaction to return the job application when findUnique is called
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                const mockTx = {
                    profile: {
                        create: jest.fn().mockResolvedValue({ id: 'profile-id' }),
                    },
                    jobApplication: {
                        findUnique: jest.fn().mockResolvedValue(mockApplication), // Return the application
                        update: jest.fn().mockResolvedValue({
                            ...mockApplication,
                            status: ApplicationStatus.APPROVED,
                        }),
                    },
                };
                return await callback(mockTx);
            });

            // Execute
            const result = await approveJobApplication('test-id');

            // Assert
            expect(result).toBeDefined();
            // The function uses the transaction's update method, not the main prisma client
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('should handle application not found', async () => {
            // Override mock to use admin user type for this test
            mockCreateClient.mockReturnValueOnce({
                auth: {
                    getSession: jest.fn().mockResolvedValue({
                        data: { session: { access_token: 'mock-token' } },
                        error: null,
                    }),
                    getUser: jest.fn().mockResolvedValue({
                        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
                        error: null,
                    }),
                },
                from: jest.fn(() => ({
                    select: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockReturnThis(),
                    update: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockReturnThis(),
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: { type: 'ADMIN' }, // Admin user type
                            error: null,
                        }),
                        data: [{ type: 'ADMIN' }],
                        error: null,
                    })),
                })),
            });

            // Setup mocks
            (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue(null);

            // Execute and assert
            await expect(approveJobApplication('non-existent-id')).rejects.toThrow('Job application not found.');
        });
    });
});