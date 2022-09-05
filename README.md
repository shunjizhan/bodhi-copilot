# bodhi-copilot
`copilot app init` initiated the bodhi app, which will create a stack `bodhi-infrastructure-roles`, which Configure the AWSCloudFormationStackSetAdministrationRole to enable use of AWS CloudFormation StackSets. It has two `AWS::IAM::Role` roles:
- AdministrationRole
- ExecutionRole

`copilot init --name rpc-adapter-mandala-http -t "Load Balanced Web Service"`
`copilot init --name rpc-adapter-mandala-ws -t "Load Balanced Web Service"`

`copilot env init --name test`, it will create `StackSet-bodhi-infrastructure-<hash>` stack, which is the Cross-regional resources to support the CodePipeline for a workspace. And a `bodhi-test` stack, which is the CloudFormation environment bootstrap template with the necessary roles to create envs and workloads, with two `AWS::IAM::Role` roles:
- CloudformationExecutionRole
- EnvironmentManagerRole

- `copilot env deploy --name test` will add a lot of resources to `bodhi-test`

`copilot deploy --name rpc-adapter-mandala-http --env test`
`copilot deploy --name rpc-adapter-mandala-ws --env test`
will create `bodhi-test-rpc-adapter-mandala-http` stack

the public url can be found in `bodhi-test.Outputs.PublicLoadBalancerDNSName`


## postgres
`copilot svc init --name postgres --svc-type "Backend Service" --port 5432 --dockerfile postgres.Dockerfile`

```
aws ssm put-parameter \
--name /bodhi/test/POSTGRES_PASSWORD \
--value postgres \
--type SecureString \
--tags Key=copilot-environment,Value=test Key=copilot-application,Value=bodhi
```

## issue
https://github.com/aws/copilot-cli/issues/1783#issuecomment-1078511188


## TODO
- expose multiple port https://docs.aws.amazon.com/AmazonECS/latest/developerguide/register-multiple-targetgroups.html
- enable https
- domain name
- pipeline