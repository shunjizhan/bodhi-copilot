FROM acala/eth-rpc-adapter:f06af9b
EXPOSE 8545
EXPOSE 3331

ENTRYPOINT ["yarn", "start"]
