import { describe, expect, test } from 'vitest';
import { trafficControlTestExports } from '../../server/utils/trafficControl';

const client = {
  id: 1,
  enabled: true,
  ipv4Address: '10.13.13.2',
  ipv6Address: 'fdcc::2',
  downloadLimitMbps: 25,
  uploadLimitMbps: 10,
};

describe('trafficControl', () => {
  test('creates download shaping and upload policing rules', () => {
    const plan = trafficControlTestExports.buildTrafficControlPlan(
      'wg0',
      [client],
      true
    );

    expect(plan.cleanup).toEqual([
      'tc qdisc del dev wg0 root 2>/dev/null || true',
      'tc qdisc del dev wg0 ingress 2>/dev/null || true',
    ]);
    expect(plan.download).toContain(
      'tc filter add dev wg0 protocol ip parent 1: prio 10 flower dst_ip 10.13.13.2 classid 1:100'
    );
    expect(plan.download).toContain(
      'tc filter add dev wg0 protocol ipv6 parent 1: prio 11 flower dst_ip fdcc::2 classid 1:100'
    );
    expect(plan.upload).toContain(
      'tc filter add dev wg0 parent ffff: protocol ip prio 10 flower src_ip 10.13.13.2 action police rate 10mbit burst 160kb conform-exceed drop'
    );
  });

  test('does not create rules for unlimited or disabled clients', () => {
    const plan = trafficControlTestExports.buildTrafficControlPlan(
      'wg0',
      [
        { ...client, downloadLimitMbps: null, uploadLimitMbps: null },
        { ...client, id: 2, enabled: false },
      ],
      false
    );

    expect(plan.download).toEqual([]);
    expect(plan.upload).toEqual([]);
  });

  test('rejects unsafe interface names', () => {
    expect(() =>
      trafficControlTestExports.buildTrafficControlPlan(
        'wg0; reboot',
        [client],
        false
      )
    ).toThrow('Invalid network interface name');
  });

  test('bounds policing burst size', () => {
    expect(trafficControlTestExports.burstKilobytes(1)).toBe(64);
    expect(trafficControlTestExports.burstKilobytes(100)).toBe(1600);
    expect(trafficControlTestExports.burstKilobytes(10000)).toBe(2048);
  });
});
