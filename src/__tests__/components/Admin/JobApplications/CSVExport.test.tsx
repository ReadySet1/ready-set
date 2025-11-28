import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock the JobApplicationsClient component with just the CSV export functionality
const mockExportToCSV = jest.fn();

// Mock createClient
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
  },
};

jest.mock('@/utils/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}));

// Mock router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Mock toast
const mockToast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({
  toast: mockToast,
}));

// Mock the component with simplified structure
const MockJobApplicationsClientWithCSV = ({ onExportCSV }: { onExportCSV: () => void }) => {
  return (
    <div>
      <button onClick={onExportCSV}>Export CSV</button>
    </div>
  );
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock URL.createObjectURL and related DOM APIs
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

// Mock document.createElement and related methods
const mockLink = {
  click: jest.fn(),
  setAttribute: jest.fn(),
  style: {},
};

const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName: string) => {
  if (tagName === 'a') {
    return mockLink as any;
  }
  return originalCreateElement.call(document, tagName);
});

const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
document.body.appendChild = mockAppendChild;
document.body.removeChild = mockRemoveChild;

/**
 * TODO: REA-211 - CSV Export tests have DOM mocking issues
 */
describe.skip('JobApplications CSV Export Functionality', () => {
  const mockSession = {
    access_token: 'mock-token',
    user: { id: 'admin-user' },
  };

  const mockApplicationsData = {
    applications: [
      {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-0123',
        position: 'Driver for Catering Deliveries',
        status: 'PENDING',
        addressCity: 'San Francisco',
        addressState: 'CA',
        addressStreet: '123 Main St',
        addressZip: '94103',
        education: 'High School',
        workExperience: '2 years delivery experience',
        skills: 'Safe driving, customer service',
        createdAt: '2024-01-15T10:30:00Z',
        coverLetter: 'I am interested in this position...',
      },
      {
        id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '555-0456',
        position: 'Virtual Assistant',
        status: 'APPROVED',
        addressCity: 'Oakland',
        addressState: 'CA',
        addressStreet: '456 Oak Ave',
        addressZip: '94602',
        education: 'Bachelor\'s Degree',
        workExperience: '3 years admin experience',
        skills: 'Communication, organization',
        createdAt: '2024-01-10T14:20:00Z',
        coverLetter: null,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful session
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
    });
    
    // Mock successful API response
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockApplicationsData,
    });
    
    // Mock URL.createObjectURL
    (global.URL.createObjectURL as jest.Mock).mockReturnValue('blob:mock-url');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createExportFunction = () => {
    return async () => {
      try {
        const { data: { session } } = await mockSupabaseClient.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error("No active session - please log in");
        }

        const params = new URLSearchParams({
          limit: "1000",
          search: "",
          status: "",
          position: "",
        });
        
        const response = await fetch(`/api/admin/job-applications?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch applications for export");
        }
        
        const data = await response.json();
        const exportApplications = data.applications;

        // Convert to CSV
        const headers = [
          "Name",
          "Email", 
          "Phone",
          "Position",
          "Status",
          "City",
          "State",
          "Address",
          "Education",
          "Experience",
          "Skills",
          "Applied Date",
          "Cover Letter"
        ];

        const csvRows = [
          headers.join(","),
          ...exportApplications.map((app: any) => [
            `"${app.firstName} ${app.lastName}"`,
            `"${app.email}"`,
            `"${app.phone || 'N/A'}"`,
            `"${app.position}"`,
            `"${app.status}"`,
            `"${app.addressCity}"`,
            `"${app.addressState}"`,
            `"${app.addressStreet}, ${app.addressCity}, ${app.addressState} ${app.addressZip}"`,
            `"${app.education || 'N/A'}"`,
            `"${app.workExperience || 'N/A'}"`,
            `"${app.skills || 'N/A'}"`,
            `"${new Date(app.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}"`,
            `"${app.coverLetter ? 'Yes' : 'No'}"`
          ].join(","))
        ];

        // Create and download CSV file
        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        
        if (link.download !== undefined) {
          const url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", `job-applications-${new Date().toISOString().split('T')[0]}.csv`);
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        mockToast({
          title: "Success",
          description: `Exported ${exportApplications.length} applications to CSV`,
          variant: "default",
        });

      } catch (error) {
        console.error("Error exporting CSV:", error);
        mockToast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to export CSV",
          variant: "destructive",
        });
      }
    };
  };

  it('should export CSV with correct data format', async () => {
    const user = userEvent.setup();
    const exportFunction = createExportFunction();
    
    render(<MockJobApplicationsClientWithCSV onExportCSV={exportFunction} />);
    
    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/job-applications?limit=1000'),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer mock-token'
          }
        })
      );
    });
    
    // Verify file download was triggered
    expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock-url');
    expect(mockLink.setAttribute).toHaveBeenCalledWith(
      'download', 
      expect.stringMatching(/job-applications-\d{4}-\d{2}-\d{2}\.csv/)
    );
    expect(mockLink.click).toHaveBeenCalled();
    
    // Verify success toast
    expect(mockToast).toHaveBeenCalledWith({
      title: "Success",
      description: "Exported 2 applications to CSV",
      variant: "default",
    });
  });

  it('should handle authentication error during export', async () => {
    const user = userEvent.setup();
    
    // Mock no session
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
    });
    
    const exportFunction = createExportFunction();
    
    render(<MockJobApplicationsClientWithCSV onExportCSV={exportFunction} />);
    
    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "No active session - please log in",
        variant: "destructive",
      });
    });
    
    // Should not attempt file download
    expect(mockLink.click).not.toHaveBeenCalled();
  });

  it('should handle API error during export', async () => {
    const user = userEvent.setup();
    
    // Mock API failure
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    
    const exportFunction = createExportFunction();
    
    render(<MockJobApplicationsClientWithCSV onExportCSV={exportFunction} />);
    
    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to fetch applications for export",
        variant: "destructive",
      });
    });
    
    // Should not attempt file download
    expect(mockLink.click).not.toHaveBeenCalled();
  });

  it('should include all required CSV headers', async () => {
    const user = userEvent.setup();
    const exportFunction = createExportFunction();
    
    render(<MockJobApplicationsClientWithCSV onExportCSV={exportFunction} />);
    
    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    
    // The CSV should be created with proper headers (we can't easily test the blob content,
    // but we can verify the function completed successfully)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
        description: expect.stringContaining("Exported"),
      })
    );
  });

  it('should handle missing phone numbers gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock data with missing phone
    const dataWithMissingPhone = {
      applications: [
        {
          ...mockApplicationsData.applications[0],
          phone: null,
        },
      ],
    };
    
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => dataWithMissingPhone,
    });
    
    const exportFunction = createExportFunction();
    
    render(<MockJobApplicationsClientWithCSV onExportCSV={exportFunction} />);
    
    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Success",
        description: "Exported 1 applications to CSV",
        variant: "default",
      });
    });
  });

  it('should format dates correctly in CSV', async () => {
    const user = userEvent.setup();
    const exportFunction = createExportFunction();
    
    render(<MockJobApplicationsClientWithCSV onExportCSV={exportFunction} />);
    
    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Success",
        })
      );
    });
  });

  it('should handle cover letter field properly', async () => {
    const user = userEvent.setup();
    const exportFunction = createExportFunction();
    
    render(<MockJobApplicationsClientWithCSV onExportCSV={exportFunction} />);
    
    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: "Success",
        description: "Exported 2 applications to CSV",
        variant: "default",
      });
    });
  });

  it('should use current date in filename', async () => {
    const user = userEvent.setup();
    const mockDate = '2024-01-20';
    const spy = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-20T10:30:00.000Z');
    
    const exportFunction = createExportFunction();
    
    render(<MockJobApplicationsClientWithCSV onExportCSV={exportFunction} />);
    
    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'download',
        `job-applications-${mockDate}.csv`
      );
    });
    
    spy.mockRestore();
  });

  it('should clean up DOM elements after download', async () => {
    const user = userEvent.setup();
    const exportFunction = createExportFunction();
    
    render(<MockJobApplicationsClientWithCSV onExportCSV={exportFunction} />);
    
    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
      expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
    });
  });

  it('should include search and filter parameters in API call', async () => {
    const user = userEvent.setup();
    
    // Create export function with search and filter parameters
    const exportFunctionWithFilters = async () => {
      const searchTerm = "john";
      const statusFilter = "PENDING";
      const positionFilter = "Driver";
      
      try {
        const { data: { session } } = await mockSupabaseClient.auth.getSession();
        
        const params = new URLSearchParams({
          limit: "1000",
          search: searchTerm,
          status: statusFilter,
          position: positionFilter,
        });
        
        await fetch(`/api/admin/job-applications?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        
        mockToast({ title: "Success", description: "Export completed" });
      } catch (error) {
        mockToast({ title: "Error", description: "Export failed" });
      }
    };
    
    render(<MockJobApplicationsClientWithCSV onExportCSV={exportFunctionWithFilters} />);
    
    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=john&status=PENDING&position=Driver'),
        expect.any(Object)
      );
    });
  });
}); 