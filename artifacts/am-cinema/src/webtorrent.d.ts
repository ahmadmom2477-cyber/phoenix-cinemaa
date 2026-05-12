declare module "webtorrent" {
  interface TorrentFile {
    name: string;
    length: number;
    path: string;
    renderTo(
      element: HTMLVideoElement | HTMLAudioElement | string,
      opts?: { autoplay?: boolean; muted?: boolean },
      cb?: (err: Error | null, elem: HTMLElement) => void
    ): void;
    getBlobURL(cb: (err: Error | null, url: string) => void): void;
    createReadStream(opts?: { start?: number; end?: number }): NodeJS.ReadableStream;
  }

  interface Torrent {
    infoHash: string;
    magnetURI: string;
    name: string;
    files: TorrentFile[];
    progress: number;
    downloadSpeed: number;
    uploadSpeed: number;
    numPeers: number;
    downloaded: number;
    uploaded: number;
    length: number;
    timeRemaining: number;
    ready: boolean;
    done: boolean;
    on(event: "done", cb: () => void): this;
    on(event: "error", cb: (err: Error | string) => void): this;
    on(event: "warning", cb: (err: Error | string) => void): this;
    on(event: "metadata", cb: () => void): this;
    on(event: string, cb: (...args: unknown[]) => void): this;
    destroy(cb?: (err?: Error) => void): void;
  }

  interface WebTorrentOptions {
    tracker?: boolean | object;
    dht?: boolean | object;
    lsd?: boolean;
    webSeeds?: boolean;
  }

  class WebTorrent {
    constructor(opts?: WebTorrentOptions);
    add(
      torrentId: string | Buffer,
      cb?: (torrent: Torrent) => void
    ): Torrent;
    add(
      torrentId: string | Buffer,
      opts?: object,
      cb?: (torrent: Torrent) => void
    ): Torrent;
    remove(torrentId: string | Torrent, cb?: (err?: Error) => void): void;
    destroy(cb?: (err?: Error) => void): void;
    torrents: Torrent[];
    on(event: "error", cb: (err: Error | string) => void): this;
    on(event: "torrent", cb: (torrent: Torrent) => void): this;
    on(event: string, cb: (...args: unknown[]) => void): this;
  }

  export = WebTorrent;
}
