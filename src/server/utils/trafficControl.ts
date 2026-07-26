import { createDebug } from 'obug';
import { isIPv4, isIPv6 } from 'is-ip';
import type { ClientType } from '#db/repositories/client/types';

const TC_DEBUG = createDebug('TrafficControl');
const ROOT_RATE_MBPS = 10000;

type TrafficControlClient = Pick<
  ClientType,
  | 'id'
  | 'enabled'
  | 'ipv4Address'
  | 'ipv6Address'
  | 'downloadLimitMbps'
  | 'uploadLimitMbps'
>;

type TrafficControlPlan = {
  cleanup: string[];
  download: string[];
  upload: string[];
};

function validateInterfaceName(interfaceName: string) {
  if (!/^[a-zA-Z0-9_.-]{1,15}$/.test(interfaceName)) {
    throw new Error(`Invalid network interface name: ${interfaceName}`);
  }
}

function burstKilobytes(rateMbps: number) {
  return Math.min(2048, Math.max(64, Math.ceil(rateMbps * 16)));
}

function buildTrafficControlPlan(
  interfaceName: string,
  clients: TrafficControlClient[],
  enableIpv6: boolean
): TrafficControlPlan {
  validateInterfaceName(interfaceName);

  const enabledClients = clients.filter((client) => client.enabled);
  const downloadClients = enabledClients.filter(
    (client) => client.downloadLimitMbps !== null
  );
  const uploadClients = enabledClients.filter(
    (client) => client.uploadLimitMbps !== null
  );

  const plan: TrafficControlPlan = {
    cleanup: [
      `tc qdisc del dev ${interfaceName} root 2>/dev/null || true`,
      `tc qdisc del dev ${interfaceName} ingress 2>/dev/null || true`,
    ],
    download: [],
    upload: [],
  };

  if (downloadClients.length > 0) {
    plan.download.push(
      `tc qdisc add dev ${interfaceName} root handle 1: htb default 10`,
      `tc class add dev ${interfaceName} parent 1: classid 1:1 htb rate ${ROOT_RATE_MBPS}mbit ceil ${ROOT_RATE_MBPS}mbit`,
      `tc class add dev ${interfaceName} parent 1:1 classid 1:10 htb rate ${ROOT_RATE_MBPS}mbit ceil ${ROOT_RATE_MBPS}mbit`,
      `tc qdisc add dev ${interfaceName} parent 1:10 handle 10: fq_codel`
    );

    downloadClients.forEach((client, index) => {
      if (!isIPv4(client.ipv4Address)) {
        throw new Error(`Invalid client IPv4 address: ${client.ipv4Address}`);
      }
      if (enableIpv6 && !isIPv6(client.ipv6Address)) {
        throw new Error(`Invalid client IPv6 address: ${client.ipv6Address}`);
      }

      const classMinor = 100 + index;
      const qdiscMajor = 1000 + index;
      const rate = client.downloadLimitMbps!;

      plan.download.push(
        `tc class add dev ${interfaceName} parent 1:1 classid 1:${classMinor} htb rate ${rate}mbit ceil ${rate}mbit`,
        `tc qdisc add dev ${interfaceName} parent 1:${classMinor} handle ${qdiscMajor}: fq_codel`,
        `tc filter add dev ${interfaceName} protocol ip parent 1: prio 10 flower dst_ip ${client.ipv4Address} classid 1:${classMinor}`
      );

      if (enableIpv6) {
        plan.download.push(
          `tc filter add dev ${interfaceName} protocol ipv6 parent 1: prio 11 flower dst_ip ${client.ipv6Address} classid 1:${classMinor}`
        );
      }
    });
  }

  if (uploadClients.length > 0) {
    plan.upload.push(`tc qdisc add dev ${interfaceName} handle ffff: ingress`);

    uploadClients.forEach((client) => {
      if (!isIPv4(client.ipv4Address)) {
        throw new Error(`Invalid client IPv4 address: ${client.ipv4Address}`);
      }
      if (enableIpv6 && !isIPv6(client.ipv6Address)) {
        throw new Error(`Invalid client IPv6 address: ${client.ipv6Address}`);
      }

      const rate = client.uploadLimitMbps!;
      const burst = burstKilobytes(rate);

      plan.upload.push(
        `tc filter add dev ${interfaceName} parent ffff: protocol ip prio 10 flower src_ip ${client.ipv4Address} action police rate ${rate}mbit burst ${burst}kb conform-exceed drop`
      );

      if (enableIpv6) {
        plan.upload.push(
          `tc filter add dev ${interfaceName} parent ffff: protocol ipv6 prio 11 flower src_ip ${client.ipv6Address} action police rate ${rate}mbit burst ${burst}kb conform-exceed drop`
        );
      }
    });
  }

  return plan;
}

let rebuildPromise: Promise<void> = Promise.resolve();

async function executePlan(plan: TrafficControlPlan) {
  for (const command of [...plan.cleanup, ...plan.download, ...plan.upload]) {
    await exec(command);
  }
}

export const trafficControl = {
  async rebuild(
    interfaceName: string,
    clients: TrafficControlClient[],
    enableIpv6: boolean
  ) {
    const plan = buildTrafficControlPlan(interfaceName, clients, enableIpv6);

    rebuildPromise = rebuildPromise
      .catch(() => {})
      .then(async () => {
        TC_DEBUG(`Rebuilding limits on ${interfaceName}`);
        await executePlan(plan);
        TC_DEBUG(`Limits on ${interfaceName} rebuilt successfully`);
      });

    return rebuildPromise;
  },

  async isAvailable() {
    try {
      await exec('tc -V');
      return true;
    } catch {
      return false;
    }
  },
};

export const trafficControlTestExports = {
  buildTrafficControlPlan,
  burstKilobytes,
};
