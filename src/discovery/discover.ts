import { deriveCapabilities, flattenVesselData, type Capabilities, type PathInfo } from './inventory.js';
import type { PluginInfo, ServerInfo, SkClient } from './sk-client.js';

export interface DiscoveryResult {
  server: ServerInfo;
  paths: PathInfo[];
  capabilities: Capabilities;
  plugins: PluginInfo[];
}

/** Fetches server info, the vessel data tree and plugins, then builds the inventory. */
export async function discoverInventory(sk: SkClient): Promise<DiscoveryResult> {
  const [server, self, plugins] = await Promise.all([
    sk.getServerInfo(),
    sk.getVesselSelf(),
    sk.getPlugins(),
  ]);
  const paths = flattenVesselData(self);
  return { server, paths, capabilities: deriveCapabilities(paths), plugins };
}
