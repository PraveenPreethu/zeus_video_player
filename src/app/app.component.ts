import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

interface VideoItem {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  src: string;
}

interface Folder {
 name: string;
  description: string;
  videos: VideoItem[];
}

interface UploadedVideoRecord {
  id: string;
  title: string;
  description: string;
  folder: string;
  url: string;
  createdAt: string;
  thumbnail?: string;
  duration?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})

export class AppComponent implements OnInit {
  private apiEndpoint = '/api/videos';
  private readonly fallbackThumbnail = 'assets/upload-placeholder.svg';

  readonly folders: Folder[] = [
    {
      name: 'Action Highlights',
      description: 'High-energy trailers and cinematic sequences packed with adrenaline.',
      videos: [
        {
          id: 'action-1',
          title: 'Skyline Pursuit',
          description: 'A breathtaking chase through futuristic cityscapes with daring pilots.',
          thumbnail:
            'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
          duration: '4:18',
          src: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
        },
        {
          id: 'action-2',
          title: 'Neon Drift',
          description: 'Street racers light up the night in a neon-drenched showdown.',
          thumbnail:
            'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=80',
          duration: '3:54',
          src: 'https://samplelib.com/lib/preview/mp4/sample-10s.mp4',
        },
@@ -86,50 +86,54 @@ export class AppComponent implements OnInit {
        {
          id: 'life-3',
          title: 'Mindful Morning',
          description: 'A gentle sunrise routine to help you reset and recharge.',
          thumbnail:
            'https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=900&q=80',
          duration: '4:33',
          src: 'https://samplelib.com/lib/preview/mp4/sample-15s.mp4',
        },
      ],
    },
  ];

  selectedFolder: Folder = this.folders[0];
  selectedVideo: VideoItem | null = null;
  showUploadModal = false;
  uploadTitle = '';
  uploadDescription = '';
  uploadFile: File | null = null;
  uploadError = '';
  uploadInProgress = false;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.apiEndpoint = this.resolveApiEndpoint();
    }

    this.loadUploadedVideos();
  }

  selectFolder(folder: Folder): void {
    this.selectedFolder = folder;
    this.selectedVideo = null;
  }

  openVideo(video: VideoItem): void {
    this.selectedVideo = video;
  }

  closeVideo(): void {
    this.selectedVideo = null;
  }

  getRelatedVideos(): VideoItem[] {
    if (!this.selectedFolder || !this.selectedVideo) {
      return [];
    }

    return this.selectedFolder.videos.filter((video) => video.id !== this.selectedVideo?.id);
  }

  openUploadModal(): void {
@@ -157,51 +161,52 @@ export class AppComponent implements OnInit {

  async submitUpload(): Promise<void> {
    if (this.uploadInProgress) {
      return;
    }

    this.uploadError = '';

    if (!this.uploadTitle.trim() || !this.uploadDescription.trim() || !this.uploadFile) {
      this.uploadError = 'Title, description, and video file are required.';
      return;
    }

    this.uploadInProgress = true;

    try {
      const base64 = await this.fileToBase64(this.uploadFile);
      const payload = {
        title: this.uploadTitle.trim(),
        description: this.uploadDescription.trim(),
        originalName: this.uploadFile.name,
        folder: this.selectedFolder.name,
        data: base64,
      };

      const endpoint = this.getApiEndpoint();
      const response = await firstValueFrom(this.http.post<UploadedVideoRecord>(endpoint, payload));
      if (!response) {
        throw new Error('No response received from server.');
      }

      this.addUploadedVideo(response);
      this.resetUploadForm();
      this.showUploadModal = false;
    } catch (error) {
      console.error('Upload failed:', error);
      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          this.uploadError =
            'Unable to reach the upload service. Make sure it is running locally with "npm run server".';
          return;
        }

        const serverMessage =
          typeof error.error === 'object' && error.error?.message
            ? String(error.error.message)
            : error.message;
        this.uploadError = serverMessage || 'Unable to upload video. Please try again later.';
      } else if (error instanceof Error) {
        this.uploadError = error.message;
      } else {
        this.uploadError = 'Unable to upload video. Please try again later.';
@@ -212,81 +217,153 @@ export class AppComponent implements OnInit {
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const [, base64] = result.split(',');
          if (base64) {
            resolve(base64);
            return;
          }
        }

        reject(new Error('Failed to read the selected file.'));
      };
      reader.onerror = () => {
        reject(new Error('Unable to read the selected file.'));
      };
      reader.readAsDataURL(file);
    });
  }

  private loadUploadedVideos(): void {
    const endpoint = this.getApiEndpoint();
    this.http.get<UploadedVideoRecord[]>(endpoint).subscribe({
      next: (videos) => {
        videos.forEach((record) => this.addUploadedVideo(record));
      },
      error: (error) => {
        console.warn('Unable to load uploaded videos:', error);
      },
    });
  }

  private addUploadedVideo(record: UploadedVideoRecord): void {
    const folder = this.folders.find((item) => item.name === record.folder) ?? this.selectedFolder;
    const video: VideoItem = this.mapRecordToVideo(record);
    const existingIndex = folder.videos.findIndex((item) => item.id === video.id);

    if (existingIndex >= 0) {
      folder.videos.splice(existingIndex, 1, video);
    } else {
      folder.videos = [video, ...folder.videos];
    }
  }

  private mapRecordToVideo(record: UploadedVideoRecord): VideoItem {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      thumbnail: record.thumbnail ?? this.fallbackThumbnail,
      duration: record.duration ?? '0:00',
      src: this.resolveMediaUrl(record.url),
    };
  }

  private resolveMediaUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    const normalized = url.startsWith('/') ? url : `/${url}`;

    if (typeof window === 'undefined') {
      return normalized;
    }

    return `${window.location.origin}${normalized}`;
  }

  private resolveApiEndpoint(): string {
    if (typeof window === 'undefined') {
      return '/api/videos';
    }

    const configured = this.readConfiguredApiEndpoint();
    if (configured) {
      return configured;
    }

    const host = window.location.hostname;
    return this.isLocalHost(host) ? '/api/videos' : '/.netlify/functions/videos';
  }

  private getApiEndpoint(): string {
    if (typeof window === 'undefined') {
      return this.apiEndpoint;
    }

    if (
      !this.apiEndpoint ||
      (this.apiEndpoint === '/api/videos' && !this.isLocalHost(window.location.hostname))
    ) {
      this.apiEndpoint = this.resolveApiEndpoint();
    }

    return this.apiEndpoint;
  }

  private isLocalHost(host: string): boolean {
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host) || host.endsWith('.local');
  }

  private readConfiguredApiEndpoint(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const globalConfig = (window as Window & { ZEUS_API_BASE?: string }).ZEUS_API_BASE;
    if (typeof globalConfig === 'string' && globalConfig.trim()) {
      return this.normalizeApiEndpoint(globalConfig);
    }

    if (typeof document !== 'undefined') {
      const metaValue = document
        .querySelector('meta[name="zeus-api-base"]')
        ?.getAttribute('content');
      if (metaValue && metaValue.trim()) {
        return this.normalizeApiEndpoint(metaValue);
      }
    }

    return null;
  }

  private normalizeApiEndpoint(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '/api/videos';
    }

    const hasProtocol = trimmed.startsWith('http://') || trimmed.startsWith('https://');
    const url = hasProtocol ? trimmed : `${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
    if (url.endsWith('/videos')) {
      return url;
    }

    const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
    return `${normalized}/videos`;
  }

  private resetUploadForm(): void {
    this.uploadTitle = '';
    this.uploadDescription = '';
    this.uploadFile = null;
    this.uploadError = '';
  }

}
