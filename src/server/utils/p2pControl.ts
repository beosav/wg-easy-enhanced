import { createDebug } from 'obug';
import { isIPv4, isIPv6 } from 'is-ip';
import type { ClientType } from '#db/repositories/client/types';

const P2P_DEBUG = createDebug('P2pControl');
const CHAIN_NAME = 'WG_P2P';
const BITTORRENT_PORTS = '6881:6999,51413';
const MAX_TCP_CONNECTIONS = 100;
const MAX_NEW_UDP_PER_SECOND = 60;
const UDP_BURST = 120;
const DNS_SIGNATURES = [
  '06726f757465720a626974746f7272656e7403636f6d',
  '06726f757465720875746f7272656e7403636f6d',
  '036468740e7472616e736d697373696f6e627403636f6d',
  '036468740761656c6974697303636f6d',
  '06726f7574657208626974636f6d657403636f6d',
];

type P2pClient = Pick<
  ClientType,
  'id' | 'enabled' | 'ipv4Address' | 'ipv6Address' | 'blockP2p'
>;

type P2pRulePlan = {
  ipv4: string[];
  ipv6: string[];
};

function validateInterfaceName(interfaceName: string) {
  if (!/^[a-zA-Z0-9_.-]{1,15}$/.test(interfaceName)) {
    throw new Error(`Invalid network interface name: ${interfaceName}`);
  }
}

function hashlimitName(clientId: number, family: 4 | 6) {
  return `p2p${family}_${clientId.toString(36).slice(-8)}`;
}

function generateClientRules(
  command: 'iptables' | 'ip6tables',
  sourceAddress: string,
  clientId: number,
  family: 4 | 6
) {
  const mask = family === 4 ? 32 : 128;
  const rules = [
    `${command} -A ${CHAIN_NAME} -s ${sourceAddress} -p tcp -m multiport --dports ${BITTORRENT_PORTS} -j REJECT --reject-with tcp-reset`,
    `${command} -A ${CHAIN_NAME} -s ${sourceAddress} -p udp -m multiport --dports ${BITTORRENT_PORTS} -j DROP`,
    `${command} -A ${CHAIN_NAME} -s ${sourceAddress} -p tcp -m string --algo bm --string "BitTorrent protocol" -j REJECT --reject-with tcp-reset`,
    `${command} -A ${CHAIN_NAME} -s ${sourceAddress} -p udp -m string --algo bm --hex-string "|0000041727101980|" -j DROP`,
  ];

  for (const signature of DNS_SIGNATURES) {
    rules.push(
      `${command} -A ${CHAIN_NAME} -s ${sourceAddress} -p udp --dport 53 -m string --algo bm --hex-string "|${signature}|" -j DROP`,
      `${command} -A ${CHAIN_NAME} -s ${sourceAddress} -p tcp --dport 53 -m string --algo bm --hex-string "|${signature}|" -j REJECT --reject-with tcp-reset`
    );
  }

  rules.push(
    `${command} -A ${CHAIN_NAME} -s ${sourceAddress} -p tcp --syn -m connlimit --connlimit-above ${MAX_TCP_CONNECTIONS} --connlimit-mask ${mask} --connlimit-saddr -j REJECT --reject-with tcp-reset`,
    `${command} -A ${CHAIN_NAME} -s ${sourceAddress} -p udp -m conntrack --ctstate NEW -m hashlimit --hashlimit-above ${MAX_NEW_UDP_PER_SECOND}/second --hashlimit-burst ${UDP_BURST} --hashlimit-mode srcip --hashlimit-name ${hashlimitName(clientId, family)} -j DROP`
  );

  return rules;
}

function buildP2pRulePlan(
  interfaceName: string,
  clients: P2pClient[],
  enableIpv6: boolean
): P2pRulePlan {
  validateInterfaceName(interfaceName);

  const blockedClients = clients.filter(
    (client) => client.enabled && client.blockP2p
  );
  const plan: P2pRulePlan = { ipv4: [], ipv6: [] };

  for (const client of blockedClients) {
    if (!isIPv4(client.ipv4Address)) {
      throw new Error(`Invalid client IPv4 address: ${client.ipv4Address}`);
    }
    plan.ipv4.push(
      ...generateClientRules('iptables', client.ipv4Address, client.id, 4)
    );

    if (enableIpv6) {
      if (!isIPv6(client.ipv6Address)) {
        throw new Error(`Invalid client IPv6 address: ${client.ipv6Address}`);
      }
      plan.ipv6.push(
        ...generateClientRules('ip6tables', client.ipv6Address, client.id, 6)
      );
    }
  }

  return plan;
}

async function removeChain(
  command: 'iptables' | 'ip6tables',
  interfaceName: string
) {
  await exec(
    `${command} -D FORWARD -i ${interfaceName} -j ${CHAIN_NAME} 2>/dev/null || true`
  );
  await exec(`${command} -F ${CHAIN_NAME} 2>/dev/null || true`);
  await exec(`${command} -X ${CHAIN_NAME} 2>/dev/null || true`);
}

async function applyRules(
  command: 'iptables' | 'ip6tables',
  interfaceName: string,
  rules: string[]
) {
  if (rules.length === 0) {
    await removeChain(command, interfaceName);
    return;
  }

  await exec(`${command} -N ${CHAIN_NAME} 2>/dev/null || true`);
  await exec(
    `${command} -C FORWARD -i ${interfaceName} -j ${CHAIN_NAME} 2>/dev/null || ${command} -I FORWARD 1 -i ${interfaceName} -j ${CHAIN_NAME}`
  );
  await exec(`${command} -F ${CHAIN_NAME}`);

  for (const rule of rules) {
    await exec(rule);
  }

  await exec(`${command} -A ${CHAIN_NAME} -j RETURN`);
}

let rebuildPromise: Promise<void> = Promise.resolve();

export const p2pControl = {
  async rebuild(
    interfaceName: string,
    clients: P2pClient[],
    enableIpv6: boolean
  ) {
    const plan = buildP2pRulePlan(interfaceName, clients, enableIpv6);

    rebuildPromise = rebuildPromise
      .catch(() => {})
      .then(async () => {
        P2P_DEBUG(`Rebuilding P2P rules on ${interfaceName}`);
        await applyRules('iptables', interfaceName, plan.ipv4);
        if (enableIpv6) {
          await applyRules('ip6tables', interfaceName, plan.ipv6);
        } else {
          await removeChain('ip6tables', interfaceName);
        }
        P2P_DEBUG(`P2P rules on ${interfaceName} rebuilt successfully`);
      });

    return rebuildPromise;
  },
};

export const p2pControlTestExports = {
  buildP2pRulePlan,
  generateClientRules,
  hashlimitName,
};
