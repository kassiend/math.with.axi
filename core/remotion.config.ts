import { Config } from '@remotion/cli/config';

// Vertical 9:16 for Instagram Reels.
Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(18);
// One frame at a time: the capture stage already paid the parallelism cost, and determinism
// matters more here than render speed.
Config.setConcurrency(1);
Config.setPublicDir('./video/public');
Config.setOverwriteOutput(true);
