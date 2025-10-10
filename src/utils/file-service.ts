// utils/file-service.ts
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';
import { UploadSecurityManager } from '@/lib/upload-security';

// File metadata type
export interface FileMetadata {
  id: string;
  file_key: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

// Define the buckets we'll use in the application
export const STORAGE_BUCKETS = {
  DEFAULT: 'user-assets',
  FILE_UPLOADER: 'fileUploader',
  CATERING_FILES: 'catering-files',
  USER_FILES: 'user-files',
  PROFILE_IMAGES: 'profile-images',
  ORDER_FILES: 'order-files',
} as const;

// Function to create storage buckets (run on app initialization)
export async function initializeStorageBuckets() {
  try {
    const supabase = await createAdminClient();

    // Create all the necessary buckets
    for (const bucketName of Object.values(STORAGE_BUCKETS)) {
      try {
        const { data, error } = await supabase.storage.getBucket(bucketName);

        if (error && error.message.includes('does not exist')) {
          // Create the bucket if it doesn't exist
          const { data: createData, error: createError } = await supabase.storage.createBucket(bucketName, {
            public: false,
            fileSizeLimit: 10 * 1024 * 1024, // 10MB
          });

          if (createError) {
            console.error(`Failed to create bucket ${bucketName}:`, createError);
          } else {
          }
        } else if (error) {
          console.error(`Error checking bucket ${bucketName}:`, error);
        } else {
        }
      } catch (bucketError) {
        console.error(`Exception handling bucket ${bucketName}:`, bucketError);
      }
    }

    // Create quarantine bucket if it doesn't exist
    try {
      const { data: quarantineData, error: quarantineError } = await supabase.storage.getBucket('quarantined-files');
      if (quarantineError && quarantineError.message.includes('does not exist')) {
        const { error: createError } = await supabase.storage.createBucket('quarantined-files', {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024, // 50MB for quarantined files
        });

        if (createError) {
          console.error('Failed to create quarantine bucket:', createError);
        } else {
        }
      } else if (quarantineError) {
        console.error('Error checking quarantine bucket:', quarantineError);
      } else {
      }
    } catch (quarantineError) {
      console.error('Exception with quarantine bucket:', quarantineError);
    }

    // Initialize security cleanup scheduler
    if (typeof window === 'undefined') { // Only run on server side
      UploadSecurityManager.startCleanupScheduler();
    }

    return { success: true };
  } catch (error) {
    console.error('Error initializing storage buckets (falling back to anon client):', error);

    // Fallback to regular client if admin client fails
    try {
      const supabase = await createClient();

      // Try to check if buckets exist (but don't try to create them with anon key)
      for (const bucketName of Object.values(STORAGE_BUCKETS)) {
        try {
          const { data, error } = await supabase.storage.getBucket(bucketName);
          if (error) {
            console.error(`Bucket ${bucketName} not accessible:`, error.message);
          } else {
          }
        } catch (bucketError) {
          console.error(`Exception checking bucket ${bucketName}:`, bucketError);
        }
      }
    } catch (fallbackError) {
      console.error('Fallback bucket check also failed:', fallbackError);
    }

    return { success: false, error };
  }
}

// Diagnostic function to check Supabase storage configuration
export async function diagnoseStorageIssues() {

  try {
    // Test admin client
    const adminClient = await createAdminClient();

    // Check if we can list buckets
    const { data: buckets, error: bucketsError } = await adminClient.storage.listBuckets();

    if (bucketsError) {
      console.error('   ❌ Failed to list buckets:', bucketsError);
      return { success: false, errors: [bucketsError], storageEnabled: false };
    } else {
      buckets?.forEach(bucket => {
      });
    }

    // Test each required bucket
    const requiredBuckets = Object.values(STORAGE_BUCKETS);
    let allBucketsExist = true;

    for (const bucketName of requiredBuckets) {
      try {
        const { data, error } = await adminClient.storage.getBucket(bucketName);

        if (error && error.message.includes('does not exist')) {
          allBucketsExist = false;

          // Try to create it
          const { error: createError } = await adminClient.storage.createBucket(bucketName, {
            public: false,
            fileSizeLimit: 10 * 1024 * 1024,
          });

          if (createError) {
            console.error(`   ❌ Failed to create bucket '${bucketName}':`, createError);
          } else {
          }
        } else if (error) {
          console.error(`   ❌ Error accessing bucket '${bucketName}':`, error);
          allBucketsExist = false;
        } else {
        }
      } catch (bucketError) {
        console.error(`   ❌ Exception testing bucket '${bucketName}':`, bucketError);
        allBucketsExist = false;
      }
    }

    // Test quarantine bucket specifically
    try {
      const { data, error } = await adminClient.storage.getBucket('quarantined-files');
      if (error && error.message.includes('does not exist')) {
        const { error: createError } = await adminClient.storage.createBucket('quarantined-files', {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024,
        });
        if (createError) {
          console.error('   ❌ Failed to create quarantine bucket:', createError);
        } else {
        }
      } else if (error) {
        console.error('   ❌ Error accessing quarantine bucket:', error);
      } else {
      }
    } catch (quarantineError) {
      console.error('   ❌ Exception testing quarantine bucket:', quarantineError);
    }

    // Test regular client
    const regularClient = await createClient();

    const storageWorking = allBucketsExist && !bucketsError;

    return { success: storageWorking, storageEnabled: true };

  } catch (error) {
    console.error('❌ Storage diagnostics failed:', error);
    return { success: false, errors: [error], storageEnabled: false };
  }
}

// Function to get a URL for a file
export async function getFileUrl(bucketName: string, filePath: string) {
  const supabase = await createClient();
  
  try {
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw error;
  }
}

// Function to generate a signed URL for a file (useful for private files)
export async function getSignedUrl(bucketName: string, filePath: string, expiresIn = 60) {
  const supabase = await createClient();
  
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
}

// Function to save file metadata to database
export async function saveFileMetadata(metadata: Omit<FileMetadata, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient();
  
  try {
    // Use raw query to avoid type issues with the file_metadata table
    // that's not properly typed in the Supabase client
    const { data, error } = await (supabase as any)
      .from('file_metadata')
      .insert([metadata])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving file metadata:', error);
    throw error;
  }
}

// Function to update entity ID for files
export async function updateFileEntityId(oldEntityId: string, newEntityId: string, userId: string) {
  const supabase = await createClient();
  
  try {
    // Use a direct RPC call that's defined in the database
    const { data, error } = await (supabase as any)
      .rpc('update_file_entity_id', {
        p_old_entity_id: oldEntityId,
        p_new_entity_id: newEntityId,
        p_user_id: userId
      });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error updating file entity ID:', error);
    throw error;
  }
}

// Function to get files for an entity
export async function getFilesForEntity(entityType: string, entityId: string) {
  const supabase = await createClient();
  
  try {
    // Use type assertion to bypass type checking for the file_metadata table
    const { data, error } = await (supabase as any)
      .from('file_metadata')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting files for entity:', error);
    throw error;
  }
}

// Function to delete a file and its metadata
export async function deleteFile(fileKey: string, bucketName: string) {
  const supabase = await createClient();
  
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([fileKey]);
    
    if (storageError) throw storageError;
    
    // Delete metadata using type assertion
    const { error: dbError } = await (supabase as any)
      .from('file_metadata')
      .delete()
      .eq('file_key', fileKey);
    
    if (dbError) throw dbError;
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

// Function to delete orphaned files
export async function cleanupOrphanedFiles(timeThreshold = 24) {
  const supabase = await createClient();
  
  try {
    // Find all temporary files older than threshold
    const getTempFilesWithPrefix = async (prefix: string) => {
      const { data, error } = await (supabase as any)
        .from('file_metadata')
        .select('*')
        .like('entity_id', `${prefix}%`)
        .lt('created_at', new Date(Date.now() - timeThreshold * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      return data || [];
    };
    
    // Get files with both temp- and temp_ prefixes
    const tempDashFiles = await getTempFilesWithPrefix('temp-');
    const tempUnderscoreFiles = await getTempFilesWithPrefix('temp_');
    
    // Combine the results
    const orphanedFiles = [...tempDashFiles, ...tempUnderscoreFiles];
    
    if (!orphanedFiles || orphanedFiles.length === 0) {
      return { success: true, deleted: 0 };
    }
    
    
    // Define a type for the orphaned file records
    interface OrphanedFile {
      id: string;
      file_key: string;
      file_url: string;
    }
    
    // Group files by bucket for efficient deletion
    const filesByBucket: Record<keyof typeof STORAGE_BUCKETS, string[]> = {
      DEFAULT: [],
      FILE_UPLOADER: [],
      CATERING_FILES: [],
      USER_FILES: [],
      PROFILE_IMAGES: [],
      ORDER_FILES: []
    };
    
    // Process each orphaned file
    for (const file of orphanedFiles as OrphanedFile[]) {
      try {
        let bucketName: keyof typeof STORAGE_BUCKETS = 'DEFAULT';
        let filePath = '';
        
        // Try to extract bucket and path from file_url first (more reliable)
        if (file.file_url) {
          try {
            const url = new URL(file.file_url);
            const pathParts = url.pathname.split('/');
            
            // Find the index of "public" which comes before the bucket name
            const publicIndex = pathParts.findIndex(part => part === 'public');
            
            if (publicIndex !== -1 && publicIndex + 1 < pathParts.length) {
              const potentialBucketName = pathParts[publicIndex + 1];
              // Check if the bucket name is valid
              const isValidBucket = (name: string): name is keyof typeof STORAGE_BUCKETS => {
                return Object.keys(STORAGE_BUCKETS).includes(name);
              };
              
              if (potentialBucketName && isValidBucket(potentialBucketName)) {
                bucketName = potentialBucketName;
                // The path is everything after the bucket name
                const remainingParts = pathParts.slice(publicIndex + 2);
                filePath = remainingParts.length > 0 ? remainingParts.join('/') : '';
                
                if (filePath) {
                  filesByBucket[bucketName].push(filePath);
                }
                
                continue;
              }
            }
          } catch (urlError) {
            console.error('Error parsing file URL:', urlError);
            // Fall through to the file_key method below
          }
        }
        
        // Fallback to file_key parsing if URL parsing failed
        if (file.file_key) {
          // Try to determine if the key includes the bucket name
          // Format could be either "bucket/path" or just "path"
          const keyParts = file.file_key.split('/');
          const firstPart = keyParts[0];
          
          const isValidBucket = (name: string): name is keyof typeof STORAGE_BUCKETS => {
            return Object.keys(STORAGE_BUCKETS).includes(name);
          };
          
          if (firstPart && isValidBucket(firstPart)) {
            // If first part is a known bucket, use it
            bucketName = firstPart;
            const remainingParts = keyParts.slice(1);
            filePath = remainingParts.length > 0 ? remainingParts.join('/') : '';
          } else {
            // Otherwise, assume it's a path in the default bucket
            filePath = file.file_key;
          }
          
          if (filePath) {
            filesByBucket[bucketName].push(filePath);
          }
        }
      } catch (parseError) {
        console.error('Error processing orphaned file:', parseError);
      }
    }
    
      ([bucket, paths]) => `${bucket}: ${paths.length} files`
    ));
    
    // Delete files from storage
    for (const [bucket, paths] of Object.entries(filesByBucket)) {
      if (paths.length > 0) {
        const { error } = await supabase.storage.from(bucket).remove(paths);
        if (error) {
          console.error(`Error deleting files from bucket ${bucket}:`, error);
        } else {
        }
      }
    }
    
    // Delete metadata records
    const { error: deleteError } = await (supabase as any)
      .from('file_metadata')
      .delete()
      .in('id', orphanedFiles.map(f => f.id));
    
    if (deleteError) throw deleteError;
    
    
    return { success: true, deleted: orphanedFiles.length };
  } catch (error) {
    console.error('Error cleaning up orphaned files:', error);
    throw error;
  }
}