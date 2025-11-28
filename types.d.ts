/// <reference types="bun-types" />

// browser-image-compression module declaration
declare module 'browser-image-compression' {
  export interface Options {
    /** Maximum file size in MB (default: Number.POSITIVE_INFINITY) */
    maxSizeMB?: number;
    /** Maximum width/height in pixels (default: undefined) */
    maxWidthOrHeight?: number;
    /** Use web worker for better performance (default: true) */
    useWebWorker?: boolean;
    /** Maximum number of parallel web workers (default: undefined) */
    maxIteration?: number;
    /** The default quality of the exported image (default: undefined) */
    initialQuality?: number;
    /** Specify the output file type (default: input file type) */
    fileType?: string;
    /** A function called with progress (0 to 100) */
    onProgress?: (progress: number) => void;
    /** Signal to abort compression (AbortController.signal) */
    signal?: AbortSignal;
    /** Preserve EXIF metadata (default: true) */
    preserveExif?: boolean;
    /** Lib URL for web worker */
    libURL?: string;
    /** Always compress even if the file is already below maxSizeMB */
    alwaysKeepResolution?: boolean;
  }

  /**
   * Compress an image file
   * @param file - The image file to compress
   * @param options - Compression options
   * @returns Promise resolving to the compressed file
   */
  function imageCompression(file: File, options?: Options): Promise<File>;

  export default imageCompression;
}
