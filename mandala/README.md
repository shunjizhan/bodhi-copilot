# Bodhi Mandala
## init the project
`copilot app init`

It creates a stack `bodhim-infrastructure-roles`, which Configure the AWSCloudFormationStackSetAdministrationRole to enable use of AWS CloudFormation StackSets.It has two `AWS::IAM::Role` roles:
- AdministrationRole
- ExecutionRole

## deploy dev env
`copilot env init --name dev`

It will create two stacks:
-  `StackSet-bodhim-infrastructure-<hash>`: the Cross-regional resources to support the CodePipeline for a workspace. When we init an service, it will update it's ECR by adding a repo to store the docker image in the future.
-  `bodhim-dev` stack: the CloudFormation environment bootstrap template with the necessary roles to create envs and workloads, with two `AWS::IAM::Role` roles:
   - CloudformationExecutionRole
   - EnvironmentManagerRole

`copilot env deploy --name dev` will add a lot of resources to `bodhim-dev`

## deploy services
### postgres
first setup some secrets
```
aws ssm put-parameter \
--name /bodhi/dev/POSTGRES_PASSWORD \
--value <xxxxx> \
--type SecureString \
--tags Key=copilot-environment,Value=dev Key=copilot-application,Value=bodhim
```

then init and deploy the service (this step is optional if you already have a DB running)

`copilot svc init -n postgres-mandala -t "Backend Service"`   
`copilot svc deploy -n postgres-mandala -e dev`  

### subquery
`copilot svc init -n subql-node-mandala -t "Backend Service"` 
change the corresponding variables in manifest, then:  
`copilot svc deploy -n subql-node-mandala -e dev`  

`copilot svc init -n subql-query-mandala -t "Load Balanced Web Service"`  
change the corresponding variables in manifest, then:  
`copilot svc deploy -n subql-query-mandala -e dev`  

### rpc adapter
`copilot svc init -n eth-rpc-mandala -t "Load Balanced Web Service"`  
change the corresponding variables in manifest, then:  
`copilot svc deploy -n eth-rpc-mandala -e dev`  

## config load balancer
copilot doesn't natively support exposing two ports ([issue](https://github.com/aws/copilot-cli/issues/1783#issuecomment-1078511188)), so at this point we only have `/http` pointing to `:8545`. We need some extra setup to config load balancer to point `/ws` to `:3331`. 

There are two ways to do it:
- [all-in-one script](#script)
- [command line step by step](#command-line)

### script
```
cd ../scripts/
yarn
APP=bodhim ENV=dev yarn config-ws-lb
```

### command line
create a target group
```
aws ec2 describe-vpcs

aws elbv2 create-target-group \
   --name bodhim-eth-rpc-ws \
   --port 3331 \
   --protocol HTTP \
   --vpc-id <VpcId> \
   --target-type ip \
   --health-check-port 8545 \
   --health-check-interval-seconds 300 \
   --healthy-threshold-count 2
```

add listener to the target group
```
aws elbv2 describe-load-balancers \
   --query 'LoadBalancers[*].LoadBalancerArn'

aws elbv2 describe-target-groups \
   --load-balancer-arn <LbArn>

aws elbv2 describe-target-health \
   --target-group-arn <httpTgArn> \
   --query 'TargetHealthDescriptions[*].Target.Id'

aws elbv2 register-targets \
   --target-group-arn <wsTgArn> \
   --targets Id=<id>,Port=3331
```

config listener rule
```
aws elbv2 describe-listeners \
   --load-balancer-arn <LbArn> \
   --query 'Listeners[*].ListenerArn'

aws elbv2 create-rule \
   --listener-arn <listenerArn>
   --conditions path-pattern
   --priority 1
   --actions <...>
```

## TODO
- enable https
- how does staging promotion work?
- diable health check
- clean up prev targets in target group in each update
- pipeline?