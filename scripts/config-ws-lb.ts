import {
  CreateRuleCommand,
  CreateTargetGroupCommand,
  DescribeListenersCommand,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  ElasticLoadBalancingV2Client,
  RegisterTargetsCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { EC2Client, DescribeVpcsCommand } from "@aws-sdk/client-ec2";

const region = 'ap-southeast-1';
const WS_PORT = Number(process.env.WS_PORT ?? 3331);
const ENV = process.env.env ?? 'dev';
const APP = process.env.APP ?? 'bodhim';
const TAG_VALUE = `copilot-${APP}-${ENV}`;
const ALB_ROOT_PORT = 80;   // TODO: 443 when http

const elbv2 = new ElasticLoadBalancingV2Client({ region });
const ec2 = new EC2Client({ region });

const getVpcId = async () => {
  const res = await ec2.send(new DescribeVpcsCommand({}));
  const vpc = res.Vpcs?.find(v => v.Tags?.some(t => t.Value === TAG_VALUE));
  if (!vpc?.VpcId) throw new Error(`❌ cannot find target vpc for ${TAG_VALUE}`);
  console.log(`🎉 found vpc ${vpc.VpcId} [CidrBlock ${vpc.CidrBlock}] for ${TAG_VALUE}`);

  return vpc.VpcId;
};

const createTargetGroup = async (vpcId : string) => {
  const res = await elbv2.send(new CreateTargetGroupCommand({
    VpcId: vpcId,
    Name: `${APP}-eth-rpc-ws`,
    Port: WS_PORT,
    Protocol: 'HTTP',
    TargetType: 'ip',
    HealthCheckPort: '8545',
    HealthCheckIntervalSeconds: 300,
    HealthyThresholdCount: 2,
  }));

  const tgArn = res.TargetGroups?.[0].TargetGroupArn;
  if (!tgArn) throw new Error(`❌ cannot createTargetGroup for VPC ${vpcId}`);
  console.log(`🎉 created target group: `, res.TargetGroups);

  return tgArn;
};

const getLBArn = async (vpcId: string) => {
  let res = await elbv2.send(new DescribeLoadBalancersCommand({}));
  const lb = res.LoadBalancers?.find(lb => lb.VpcId === vpcId);
  if (!lb?.LoadBalancerArn) throw new Error(`❌ cannot find target load balancer for app ${APP}`);
  console.log('🎉 found load balancer: ', lb);

  return lb.LoadBalancerArn;
};

const getEthRpcIds = async (lbArn: string) => {
  const res = await elbv2.send(new DescribeTargetGroupsCommand({
    LoadBalancerArn: lbArn,
  }));
  const ethRpcTg = res.TargetGroups?.find(tg => tg.Port === 8545);
  if (!ethRpcTg?.TargetGroupArn) throw new Error('❌ cannot find the target group for eth rpc adapter');
  
  const res2 = await elbv2.send(new DescribeTargetHealthCommand({
    TargetGroupArn: ethRpcTg.TargetGroupArn,
  }));
  if (!res2.TargetHealthDescriptions?.length) throw new Error(`❌ cannot get eth rpc target group health: ${ethRpcTg.TargetGroupArn}`);
  
  const targetIds = res2.TargetHealthDescriptions.map(d => d.Target?.Id);
  console.log(`🎉 found eth rpc ips: ${targetIds}`);

  return targetIds.filter(x => !!x) as string[];
};

const registerEthRpcIds = async (tgArn: string, ids: string[]) => {
  const res = await elbv2.send(new RegisterTargetsCommand({
    TargetGroupArn: tgArn,
    Targets: ids.map(id => ({
      Id: id,
      Port: WS_PORT, 
    })),
  }));

  console.log(`🎉 registered targets ${ids} for target group ${tgArn}`,)
};

const getListenerArn = async (lbArn: string) => {
  const res = await elbv2.send(new DescribeListenersCommand({
    LoadBalancerArn: lbArn,
  }));

  const listener = res.Listeners?.find(l => l.Port === ALB_ROOT_PORT);
  if (!listener?.ListenerArn) throw new Error(`cannot get listner for load balancer: ${lbArn}`);
  console.log(`🎉 found root listener: `, listener);

  return listener.ListenerArn;
};

const createListenerRule = async (listenerArn: string, tgArn: string) => {
  const res = await elbv2.send(new CreateRuleCommand({
    Priority: 1,
    ListenerArn: listenerArn,
    Conditions: [{
      Field: 'path-pattern',
      PathPatternConfig: {
        Values: ['/ws']
      },
    }],
    Actions: [{
      Type: 'forward',
      TargetGroupArn: tgArn,
    }],
  }));

  console.log(`🎉 created Listener Rule: `, JSON.stringify(res.Rules, null, 2));
};

const main = async () => {
  const vpcId = await getVpcId();
  const lbArn = await getLBArn(vpcId);
  const wsTgArn = await createTargetGroup(vpcId);
  const ethRpcIds = await getEthRpcIds(lbArn);
  await registerEthRpcIds(wsTgArn, ethRpcIds);

  const listenerArn = await getListenerArn(lbArn);
  await createListenerRule(listenerArn, wsTgArn);
};

main().then(
  () => process.exit(0),
  err => {
    console.log(err);
    process.exit(1);
  }
);
