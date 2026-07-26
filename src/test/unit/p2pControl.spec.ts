import { describe, expect, test } from 'vitest';
import { p2pControlTestExports } from '../../server/utils/p2pControl';

const client = {
  id: 42,
  enabled: true,
  ipv4Address: '10.13.13.2',
  ipv6Address: 'fdcc::2',
  blockP2p: true,
};

describe('p2pControl', () => {
  test('generates layered IPv4 P2P blocking rules', () => {
    const plan = p2pControlTestExports.buildP2pRulePlan('wg0', [client], false);

    expect(plan.ipv6).toEqual([]);
    expect(plan.ipv4).toContain(
      'iptables -A WG_P2P -s 10.13.13.2 -p tcp -m multiport --dports 6881:6999,51413 -j REJECT --reject-with tcp-reset'
    );
    expect(plan.ipv4).toContain(
      'iptables -A WG_P2P -s 10.13.13.2 -p tcp -m string --algo bm --string "BitTorrent protocol" -j REJECT --reject-with tcp-reset'
    );
    expect(plan.ipv4).toContain(
      'iptables -A WG_P2P -s 10.13.13.2 -p udp -m string --algo bm --hex-string "|0000041727101980|" -j DROP'
    );
    expect(plan.ipv4).toContain(
      'iptables -A WG_P2P -s 10.13.13.2 -p tcp --syn -m connlimit --connlimit-above 100 --connlimit-mask 32 --connlimit-saddr -j REJECT --reject-with tcp-reset'
    );
    expect(plan.ipv4).toContain(
      'iptables -A WG_P2P -s 10.13.13.2 -p udp -m conntrack --ctstate NEW -m hashlimit --hashlimit-above 60/second --hashlimit-burst 120 --hashlimit-mode srcip --hashlimit-name p2p4_16 -j DROP'
    );
  });

  test('generates IPv6 rules when enabled', () => {
    const plan = p2pControlTestExports.buildP2pRulePlan('wg0', [client], true);

    expect(plan.ipv6).toContain(
      'ip6tables -A WG_P2P -s fdcc::2 -p tcp -m multiport --dports 6881:6999,51413 -j REJECT --reject-with tcp-reset'
    );
    expect(plan.ipv6).toContain(
      'ip6tables -A WG_P2P -s fdcc::2 -p udp -m conntrack --ctstate NEW -m hashlimit --hashlimit-above 60/second --hashlimit-burst 120 --hashlimit-mode srcip --hashlimit-name p2p6_16 -j DROP'
    );
  });

  test('skips disabled and unblocked clients', () => {
    const plan = p2pControlTestExports.buildP2pRulePlan(
      'wg0',
      [
        { ...client, enabled: false },
        { ...client, id: 43, blockP2p: false },
      ],
      true
    );

    expect(plan).toEqual({ ipv4: [], ipv6: [] });
  });

  test('rejects unsafe interface names', () => {
    expect(() =>
      p2pControlTestExports.buildP2pRulePlan('wg0; reboot', [client], false)
    ).toThrow('Invalid network interface name');
  });

  test('keeps hashlimit names within kernel limits', () => {
    expect(p2pControlTestExports.hashlimitName(42, 4)).toBe('p2p4_16');
    expect(
      p2pControlTestExports.hashlimitName(Number.MAX_SAFE_INTEGER, 6).length
    ).toBeLessThanOrEqual(13);
  });
});
