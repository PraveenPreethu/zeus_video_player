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
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly apiBaseUrl = 'http://localhost:3000/api/videos';
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
        {
          id: 'action-3',
          title: 'Summit Rescue',
          description: 'Elite climbers attempt a daring rescue on the world’s highest peaks.',
          thumbnail:
            'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80',
          duration: '5:02',
          src: 'https://samplelib.com/lib/preview/mp4/sample-15s.mp4',
        },
      ],
    },
    {
      name: 'Documentaries',
      description: 'Inspiring stories and immersive documentaries from around the globe.',
      videos: [
        {
          id: 'doc-1',
          title: 'Ocean Guardians',
          description: 'Marine biologists uncover hidden wonders while protecting coral reefs.',
          thumbnail:
            'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
          duration: '8:45',
          src: 'https://samplelib.com/lib/preview/mp4/sample-20s.mp4',
        },
        {
          id: 'doc-2',
          title: 'Voices of the Wild',
          description: 'Listen to the heartbeats of the rainforest through local storytellers.',
          thumbnail:
            'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=900&q=80',
          duration: '9:12',
          src: 'https://samplelib.com/lib/preview/mp4/sample-30s.mp4',
        },
        {
          id: 'doc-3',
          title: 'Cities Reborn',
          description: 'A behind-the-scenes look at sustainable architecture shaping megacities.',
          thumbnail:
            'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
          duration: '7:26',
          src: 'https://samplelib.com/lib/preview/mp4/sample-12s.mp4',
        },
      ],
    },
    {
      name: 'Lifestyle & Travel',
      description: 'Slow down with curated travelogues, culinary tours, and mindful living.',
      videos: [
        {
          id: 'life-1',
          title: 'Coastal Retreats',
          description: 'Discover serene hideaways along Mediterranean coastlines.',
          thumbnail:
            'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
          duration: '6:05',
          src: 'https://samplelib.com/lib/preview/mp4/sample-5mb.mp4',
        },
        {
          id: 'life-2',
          title: 'Gourmet Journeys',
          description: 'Follow chefs as they celebrate bold flavors and regional dishes.',
          thumbnail:
            'https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=900&q=80',
          duration: '5:47',
          src: 'https://samplelib.com/lib/preview/mp4/sample-30s.mp4',
        },
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
    this.resetUploadForm();
    this.showUploadModal = true;
  }

  closeUploadModal(): void {
    if (this.uploadInProgress) {
      return;
    }

    this.resetUploadForm();
    this.showUploadModal = false;
  }

  handleFileSelection(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fileList = input.files;
    this.uploadFile = fileList && fileList.length > 0 ? fileList.item(0) : null;
    if (this.uploadFile) {
      this.uploadError = '';
    }
  }

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

      const response = await firstValueFrom(this.http.post<UploadedVideoRecord>(this.apiBaseUrl, payload));
      if (!response) {
        throw new Error('No response received from server.');
      }

      this.addUploadedVideo(response);
      this.resetUploadForm();
      this.showUploadModal = false;
    } catch (error) {
      console.error('Upload failed:', error);
      if (error instanceof HttpErrorResponse) {
        const serverMessage =
          typeof error.error === 'object' && error.error?.message
            ? String(error.error.message)
            : error.message;
        this.uploadError = serverMessage || 'Unable to upload video. Please try again later.';
      } else if (error instanceof Error) {
        this.uploadError = error.message;
      } else {
        this.uploadError = 'Unable to upload video. Please try again later.';
      }
    } finally {
      this.uploadInProgress = false;
    }
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
    this.http.get<UploadedVideoRecord[]>(this.apiBaseUrl).subscribe({
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
      src: record.url.startsWith('http') ? record.url : `http://localhost:3000${record.url}`,
    };
  }

  private resetUploadForm(): void {
    this.uploadTitle = '';
    this.uploadDescription = '';
    this.uploadFile = null;
    this.uploadError = '';
  }
}
