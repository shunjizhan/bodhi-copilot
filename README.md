# bodhi-copilot
## init the project
`copilot app init --domain aca-dev.network` initiated the bodhi app, which will create a stack `bodhi-infrastructure-roles`, which Configure the AWSCloudFormationStackSetAdministrationRole to enable use of AWS CloudFormation StackSets. It has two `AWS::IAM::Role` roles:
- AdministrationRole
- ExecutionRole

## init and deploy the dev env
`copilot env init --name dev`, it will create two stacks:
-  `StackSet-bodhi-infrastructure-<hash>`: the Cross-regional resources to support the CodePipeline for a workspace. When we init an service, it will update it's ECR by adding a repo to store the docker image in the future.
-  `bodhi-dev` stack: the CloudFormation environment bootstrap template with the necessary roles to create envs and workloads, with two `AWS::IAM::Role` roles:
   - CloudformationExecutionRole
   - EnvironmentManagerRole

- `copilot env deploy --name dev` will add a lot of resources to `bodhi-dev`

## init and deploy the services
### postgres
first setup some secrets
```
aws ssm put-parameter \
--name /bodhi/dev/POSTGRES_PASSWORD \
--value xxxxx \
--type SecureString \
--tags Key=copilot-environment,Value=test Key=copilot-application,Value=bodhi
```

then init and deploy the service
`copilot svc init -n postgres-mandala -t "Backend Service"` 
`copilot svc deploy -n postgres-mandala -e dev`


### subquery
`copilot svc init -n subql-node-mandala -t "Load Balanced Web Service"`
`copilot svc deploy -n subql-node-mandala -e dev`

`copilot svc init -n subql-query-mandala -t "Load Balanced Web Service"`
`copilot svc deploy -n subql-query-mandala -e dev`

### rpc adapter
`copilot svc init -n eth-rpc-mandala -t "Load Balanced Web Service"`
`copilot svc deploy -n eth-rpc-mandala -e dev`

will create `bodhi-dev-eth-rpc-mandala` stack

The public url can be found in stack `bodhi-dev.Outputs.PublicLoadBalancerDNSName` + `http`.

Then we can setup a new subdomain from route53 to point to that ALB.

## issue
https://github.com/aws/copilot-cli/issues/1783#issuecomment-1078511188


## TODO
- expose multiple port https://docs.aws.amazon.com/AmazonECS/latest/developerguide/register-multiple-targetgroups.html, might just need to configure ALB?
- enable https
- pipeline
- diable health check
```
healthcheck:
command: ["CMD-SHELL", "echo \"dummy health check\""]
interval: 9999999s
```