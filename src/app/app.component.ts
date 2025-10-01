import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

interface CloudVideoResponse {
  Name: string;
  ContentType: string;
  Size: number;
}

interface CloudVideoSummary {
  id: string;
  name: string;
  contentType: string;
  size: number;
  displayName: string;
  formattedSize: string;
  thumbnail: string;
}

interface RequestPlaybackResponse {
  playbackUrl: string;
  expiresAt: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})

export class AppComponent implements OnInit {
  private readonly cloudLibraryEndpoint =
    'https://zeus-videos-gtcudxfwaaethsa7.southcentralus-01.azurewebsites.net/api/listvideos';
  private readonly requestPlaybackEndpoint =
    'https://zeus-videos-gtcudxfwaaethsa7.southcentralus-01.azurewebsites.net/api/RequestPlay';
  private readonly cloudThumbnail =
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80';

  cloudVideos: CloudVideoSummary[] = [];
  cloudLoadError = '';
  cloudLoading = true;

  playbackState: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  playbackVideoTitle = '';
  playbackUrl = '';
  playbackExpiresAt = '';
  playbackErrorMessage = '';
  requestingVideoId: string | null = null;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadCloudVideos();
  }

  private loadCloudVideos(): void {
    this.cloudLoading = true;
    this.http.get<CloudVideoResponse[]>(this.cloudLibraryEndpoint).subscribe({
      next: (videos) => {
        this.cloudLoadError = '';
        this.cloudVideos = videos.map((video, index) => this.mapCloudVideo(video, index));
        this.cloudLoading = false;
      },
      error: (error) => {
        console.warn('Unable to load cloud videos:', error);
        this.cloudLoadError = 'Unable to load the cloud video library right now. Please try again later.';
        this.cloudLoading = false;
      },
    });
  }

  private mapCloudVideo(video: CloudVideoResponse, index: number): CloudVideoSummary {
    const id = `${video.Name}-${index}`;
    return {
      id,
      name: video.Name,
      contentType: video.ContentType,
      size: video.Size,
      displayName: this.getCloudVideoDisplayName(video.Name),
      formattedSize: this.formatFileSize(video.Size),
      thumbnail: this.cloudThumbnail,
    };
  }

  private getCloudVideoDisplayName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      return 'Untitled Video';
    }

    const lastDot = trimmed.lastIndexOf('.');
    if (lastDot <= 0) {
      return trimmed;
    }

    return trimmed.slice(0, lastDot);
  }

  private formatFileSize(size: number): string {
    if (!Number.isFinite(size) || size <= 0) {
      return 'Unknown size';
    }

    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    let index = 0;
    let value = size;

    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }

    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  }

  trackCloudVideo(_: number, video: CloudVideoSummary): string {
    return video.id;
  }

  requestPlayback(video: CloudVideoSummary): void {
    const passcode = window.prompt(`Enter passcode for "${video.displayName}"`);

    if (passcode === null) {
      return;
    }

    const trimmed = passcode.trim();

    if (!trimmed) {
      this.playbackState = 'error';
      this.playbackVideoTitle = video.displayName;
      this.playbackErrorMessage = 'A passcode is required to request playback.';
      this.playbackUrl = '';
      this.playbackExpiresAt = '';
      this.requestingVideoId = null;
      return;
    }

    this.playbackState = 'loading';
    this.playbackVideoTitle = video.displayName;
    this.playbackUrl = '';
    this.playbackExpiresAt = '';
    this.playbackErrorMessage = '';
    this.requestingVideoId = video.id;

    this.http
      .post<RequestPlaybackResponse>(this.requestPlaybackEndpoint, {
        videoId: video.name,
        passcode: trimmed,
      })
      .subscribe({
        next: (response) => {
          this.playbackState = 'success';
          this.playbackUrl = response.playbackUrl;
          this.playbackExpiresAt = response.expiresAt;
          this.playbackErrorMessage = '';
          this.requestingVideoId = null;
        },
        error: (error) => {
          this.playbackState = 'error';
          this.playbackErrorMessage = this.formatPlaybackError(error);
          this.playbackUrl = '';
          this.playbackExpiresAt = '';
          this.requestingVideoId = null;
        },
      });
  }

  private formatPlaybackError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const errorBody = error.error;
      if (typeof errorBody === 'string' && errorBody.trim()) {
        return errorBody;
      }

      if (errorBody && typeof errorBody === 'object') {
        try {
          return JSON.stringify(errorBody, null, 2);
        } catch {
          return `${error.message} (status ${error.status})`;
        }
      }

      if (error.message) {
        return error.message;
      }

      return `Request failed with status ${error.status}`;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return 'An unknown error occurred while requesting playback.';
    }
  }
}

