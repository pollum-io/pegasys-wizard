<script lang="ts">
  import type {
    Contract,
    Kind,
    KindedOptions,
    OptionsErrorMessages,
  } from "@openzeppelin/wizard";
  import {
    buildGeneric,
    ContractBuilder,
    OptionsError,
    printContract,
    printContractVersioned,
    sanitizeKind,
  } from "@openzeppelin/wizard";
  import axios from "axios";
  import { saveAs } from "file-saver";
  import { createEventDispatcher, onMount } from "svelte";
  import ERC1155Controls from "./ERC1155Controls.svelte";
  import ERC20Controls from "./ERC20Controls.svelte";
  import ERC721Controls from "./ERC721Controls.svelte";
  import GovernorControls from "./GovernorControls.svelte";
  import hljs from "./highlightjs";
  import CopyIcon from "./icons/CopyIcon.svelte";
  import DocsIcon from "./icons/DocsIcon.svelte";
  import FileIcon from "./icons/FileIcon.svelte";
  import ForumIcon from "./icons/ForumIcon.svelte";
  import RemixIcon from "./icons/RemixIcon.svelte";
  import OverflowMenu from "./OverflowMenu.svelte";
  import { postConfig } from "./post-config";
  import { remixURL } from "./remix";
  import Tooltip from "./Tooltip.svelte";
  import { ethers } from "ethers";
  import { RingLoader } from "svelte-loading-spinners";

  import PegasysVoteBytecode from "./abi/PegasysVoteBytecode.json";
  import PegasysVoteAbi from "./abi/PegasysVoteAbi.json";
  import PegasysToken from "@pollum-io/pegasys-protocol/artifacts/contracts/PegasysToken.sol/PegasysToken.json";

  let provider
  let signer
   
 const changeWallet = async () => {
    if(window.ethereum) {
    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    })
    window.ethereum.on('accountsChanged', () => {
      window.location.reload();
    }) }
 }
$: walletConnected =  changeWallet()

$: unlockAddress = handleLockWizard();

 	onMount(async () => {
    handleLockWizard();
	});
  const dispatch = createEventDispatcher();

  export let tab: Kind = "ERC20";
  $: {
    tab = sanitizeKind(tab);
    dispatch("tab-change", tab);
  }

  let allOpts: { [k in Kind]?: Required<KindedOptions[k]> } = {};
  let errors: { [k in Kind]?: OptionsErrorMessages } = {};

  let contract: Contract = new ContractBuilder("MyToken");

  $: opts = allOpts[tab];

  $: {
    if (opts) {
      try {
        contract = buildGeneric(opts);
        errors[tab] = undefined;
      } catch (e: unknown) {
        if (e instanceof OptionsError) {
          errors[tab] = e.messages;
        } else {
          throw e;
        }
      }
    }
  }

  $: code = printContract(contract);
  $: highlightedCode = hljs.highlight("solidity", code).value;

  const copyHandler = async () => {
    await navigator.clipboard.writeText(code);
    if (opts) {
      await postConfig(opts, "copy");
    }
  };

  const truncateRegex = /^(0x[a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})$/;

  const truncateEthAddress = (address) => {
    const match = address.match(truncateRegex);
    if (!match) return address;
    return `${match[1]}…${match[2]}`;
  };
  let signerAddress;
  let psysBalance;
  // let unlockAddress;

  const handleLockWizard = async () => {
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    const signerFullAddress = await signer.getAddress();
    signerAddress = truncateEthAddress(signerFullAddress);
    const contract = new ethers.ContractFactory(
      PegasysVoteAbi.output.abi,
      PegasysVoteBytecode.data.bytecode,
      signer
    );
    const contractPsysToken = new ethers.ContractFactory(
      PegasysToken.abi,
      PegasysToken.bytecode,
      signer
    );

    const contractPegasysVote = await contract.attach(
      "0xDB0ddF4c3b3aB7d16Ec5Ff8Ca29B00267aE42760"
    );
    const psysToken = await contractPsysToken.attach(
      "0x81821498cD456c9f9239010f3A9F755F3A38A778"
    );
    psysBalance = await psysToken.balanceOf(signerFullAddress);
    psysBalance = ethers.utils.formatEther(psysBalance);
    psysBalance = parseFloat(psysBalance).toFixed(4);
    unlockAddress = await contractPegasysVote.getBalance();
    console.log("deuu boa", unlockAddress, psysBalance);
    return unlockAddress;
  };
  
  const remixHandler = async (e: MouseEvent) => {
    e.preventDefault();
    if ((e.target as Element)?.classList.contains("disabled")) return;
    const versionedCode = printContractVersioned(contract);
    window.open(remixURL(versionedCode).toString(), "_blank");
    if (opts) {
      await postConfig(opts, "remix");
    }
  };

  function removeNumbersFromFront(srt) {
    var i = 0;
    while (srt[i] >= "0" && srt[i] <= "9") {
      i++;
    }
    return srt.substring(i);
  }
  const regex = /["'\/\[\]~!@#\$%\^\&*\)\(+=._-]+/g;

  function removeSymbolsFromFront(srt) {
    var outString = srt.replace(regex, "");
    return outString;
  }

  function isValidName(name: string): boolean {
    if (name.match(regex)) {
      return false;
    }
    return true;
  }

  const compilerHandler = async () => {
    if (opts) {
      const url = "http://localhost:3000/compiler";
      const titleContract = opts.name;

      if (isValidName(titleContract)) {
        const contractNoNumber = removeNumbersFromFront(titleContract);
        const contractNoSymbols = removeSymbolsFromFront(contractNoNumber);
        console.log(contractNoSymbols);
        axios.defaults.headers.post["Content-Type"] =
          "application/x-www-form-urlencoded";
        axios
          .post(url, {
            title: contractNoSymbols,
            code: code,
          })
          .then(async (res) => {
            console.log(res);
            await deployHandler();
          })
          .catch((err) => {
            console.log(err);
          });
      } else {
        alert("Please enter a valid name");
      }
    }
  };
  let contractAddress;
  let deployTransaction = false;

  const deployHandler = async () => {
    deployTransaction = true;
    console.log("Account:", await signer.getAddress());
    if (opts) {
      const url = "http://localhost:3000/compiler";
      const titleContract = opts.name;
      const contractNoNumber = removeNumbersFromFront(titleContract);
      const contractNoSymbols = removeSymbolsFromFront(contractNoNumber);

      console.log(contractNoSymbols);
      axios
        .get(url + `/${contractNoSymbols}`)
        .then(async (response) => {
          console.log(response.data);
          const abi = response.data.abi;
          const bytecode = response.data.bytecode;
          const contract = new ethers.ContractFactory(abi, bytecode, signer);

          const deploy = await contract
            .deploy()
            .catch(() => {
              deployTransaction = false;
            });
             deployTransaction = false;
        contractAddress = await deploy.address;

        })
        .catch((err) => {
          console.log(err);
        });
    }
  };
  const compilerWithArgsHandler = async () => {
    if (opts) {
      const url = "http://localhost:3000compiler";
      const titleContract = opts.name;

      if (isValidName(titleContract)) {
        const contractNoNumber = removeNumbersFromFront(titleContract);
        const contractNoSymbols = removeSymbolsFromFront(contractNoNumber);
        console.log(contractNoSymbols);
        axios.defaults.headers.post["Content-Type"] =
          "application/x-www-form-urlencoded";
        axios
          .post(url, {
            title: contractNoSymbols,
            code: code,
          })
          .then(async (res) => {
            console.log(res);
            await deployWithArgsHandler();
          })
          .catch((err) => {
            console.log(err);
          });
      } else {
        alert("Please enter a valid name");
      }
    }
  };

  const deployWithArgsHandler = async () => {
    if (opts) {
      const url = "http://localhost:3000/compiler";
      const titleContract = opts.name;
      const contractNoNumber = removeNumbersFromFront(titleContract);
      const contractNoSymbols = removeSymbolsFromFront(contractNoNumber);

      console.log(contractNoSymbols);
      axios
        .get(url + `/${contractNoSymbols}`)
        .then(async (response) => {
          const constructorArgs = [
            opts.constructorToken,
            opts.constructorTimelock,
          ];
          console.log(response.data);
          const abi = response.data.abi;
          const bytecode = response.data.bytecode;
          const contract = new ethers.ContractFactory(abi, bytecode, signer);
          const deploy = await contract
            .deploy(...constructorArgs)
            .catch(() => {
              deployTransaction = false;
            });
            deployTransaction = false;
            contractAddress = await deploy.address;
        })
        .catch((err) => {
          console.log(err);
        });
    }
  };

  const downloadNpmHandler = async () => {
    const blob = new Blob([code], { type: "text/plain" });
    if (opts) {
      saveAs(blob, opts.name + ".sol");
      await postConfig(opts, "download-npm");
    }
  };



  const zipModule = import("@openzeppelin/wizard/zip");


</script>
{#if unlockAddress}
  <div class="container flex flex-col gap-4 p-4">
    <div class="header flex flex-row justify-between">
      <div class="tab overflow-hidden">
        <OverflowMenu>
          <button
            class:selected={tab === "ERC20"}
            on:click={() => (tab = "ERC20")}
          >
            ERC20
          </button>
          <button
            class:selected={tab === "ERC721"}
            on:click={() => (tab = "ERC721")}
          >
            ERC721
          </button>
          <button
            class:selected={tab === "ERC1155"}
            on:click={() => (tab = "ERC1155")}
          >
            ERC1155
          </button>
          <!-- <button
          class:selected={tab === "Governor"}
          on:click={() => (tab = "Governor")}
        >
          Governor
        </button> -->
        </OverflowMenu>
      </div>

      <div class="action flex flex-row gap-2 shrink-0">
        {#if deployTransaction == true}
          <RingLoader size="33" color="#7227ce" unit="px" duration="2s" />
        {/if}
        {#if tab === "ERC1155" || tab === "ERC721" || tab === "ERC20"}
          <button
            class="action-button-2"
            class:disabled={opts?.name.match(regex)}
            on:click={compilerHandler}
          >
            Deploy
          </button>
        {/if}
        {#if tab === "Governor"}
          <button
            class="action-button-2"
            class:disabled={opts?.name.match(regex)}
            on:click={compilerWithArgsHandler}
          >
            Deploy
          </button>
        {/if}

        <button
          class="action-button-3"
          class:disabled={opts?.name.match(regex)}
          on:click={handleLockWizard}
        >
          {psysBalance} PSYS
        </button>
        <button
          class="action-button-4"
          class:disabled={opts?.name.match(regex)}
          on:click={handleLockWizard}
        >
          {signerAddress}
        </button>
      </div>
    </div>

    <div class="flex flex-row gap-4 grow">
      <div class="controls w-64 flex flex-col shrink-0 justify-between">
        <div class:hidden={tab !== "ERC20"}>
          <ERC20Controls bind:opts={allOpts.ERC20} />
        </div>
        <div class:hidden={tab !== "ERC721"}>
          <ERC721Controls bind:opts={allOpts.ERC721} />
        </div>
        <div class:hidden={tab !== "ERC1155"}>
          <ERC1155Controls bind:opts={allOpts.ERC1155} />
        </div>
        <div class:hidden={tab !== "Governor"}>
          <GovernorControls
            bind:opts={allOpts.Governor}
            errors={errors.Governor}
          />
        </div>
        <div class="controls-footer">
          <a href="https://forum.openzeppelin.com/" target="_blank">
            <ForumIcon /> Forum
          </a>
          <a href="https://docs.openzeppelin.com/" target="_blank">
            <DocsIcon /> Docs
          </a>
        </div>
      </div>

      <div class="output flex flex-col grow ">
        <pre class="flex flex-col grow basis-0 ">
  <code class="hljs grow overflow-auto p-4">
  {@html highlightedCode}
  </code>
  </pre>
      </div>
    </div>
    <div class="action flex flex-row gap-2 shrink-0">
      <div class="action flex flex-row gap-2 shrink-0">
        <button class="action-button" on:click={copyHandler}>
          <CopyIcon />
          Copy to Clipboard
        </button>
        <Tooltip
          let:trigger
          disabled={!opts?.upgradeable}
          theme="light-red border"
          interactive
          hideOnClick={false}
        >
          <button
            use:trigger
            class="action-button"
            class:disabled={opts?.upgradeable}
            on:click={remixHandler}
          >
            <RemixIcon />
            Open in Remix
          </button>
          <div slot="content">
            Upgradeable contracts are not supported on Remix. Use Hardhat or
            Truffle with <a
              href="https://docs.openzeppelin.com/upgrades-plugins/"
              target="_blank">OpenZeppelin Upgrades</a
            >.
            <br />
            <!-- svelte-ignore a11y-invalid-attribute -->
            <a href="#" on:click={remixHandler}>Open in Remix anyway</a>.
          </div>
        </Tooltip>
          <button class="action-button" on:click={downloadNpmHandler}>
            <FileIcon />
            Download
          </button>

       
        {#if contractAddress}
          <a
            class="action-button"
            href="https://tanenbaum.io/address/{contractAddress}"
            target="_blank"
          >
            Deployed at: {contractAddress}
          </a>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if !unlockAddress }
  <div class="container-2">
    <button
      class="action-button-5"
      class:disabled={opts?.name.match(regex)}
      on:click={handleLockWizard}
    >
    {#if signerAddress}
    {signerAddress}
    {/if}
    {#if !signerAddress}
    Connect Wallet
    {/if}
     
    </button>
    <h1 class="unlock-text">You must have 500 PSYS to unlock the Pegasys Wizard.</h1>
  </div>
{/if}

<style lang="postcss">
  .container {
    background-color: var(--gray-1);
    border: 1px solid var(--gray-2);
    border-radius: 10px;
    min-width: 32rem;
    min-height: 3rem;
    overflow-x: hidden;
  }
  .container-2 {
    background: #2124297a;
    border: 1px solid #3c8fa17b;
    border-radius: 10px; 
    min-height: 20rem;
    overflow-x: hidden;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .header {
    font-size: var(--text-small);
  }

  .tab {
    color: var(--gray-5);
  }

  .tab button,
  .action-button,
  :global(.overflow-btn) {
    padding: var(--size-2) var(--size-3);
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  }

  .tab button,
  :global(.overflow-btn) {
    border: 0;
    background-color: transparent;
  }

  .tab button:hover,
  :global(.overflow-btn):hover {
    background-color: var(--gray-2);
  }

  .tab button.selected {
    background: linear-gradient(
      160deg,
      #0093e9 0%,
      #80d0c7 100%,
      #00d9ef,
      #153d6f70,
      #04d3c0,
      #2d384f,
      #ffffff,
      #315df6,
      #25afc4
    );
    color: white;
    order: -1;
  }

  :global(.overflow-menu) button.selected {
    order: unset;
  }

  .action-button {
    background-color: var(--gray-1);
    border: 1px solid var(--gray-3);
    color: var(--gray-6);
    cursor: pointer;

    &:hover {
      background-color: var(--gray-2);
    }

    &:active,
    &.active {
      background-color: var(--gray-2);
    }

    &.disabled {
      color: var(--gray-4);
    }

    :global(.icon) {
      margin-right: var(--size-1);
    }
  }
  .tab button,
  .action-button-2,
  :global(.overflow-btn) {
    padding: var(--size-2) var(--size-3);
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  }
  .action-button-2 {
    background: linear-gradient(
      160deg,
      rgb(136, 84, 160) 0%,
      #6912a7,
      #7616cb,
      100%,
      #513974,
      #315df6,
      #315df6,
      #102c91,
      #2c12ae,
      #5115bf
    );
    border: 1px solid var(--gray-3);
    color: white;
    cursor: pointer;

    &:hover {
      background-color: var(--gray-2);
    }

    &:active,
    &.active {
      background-color: var(--gray-2);
    }

    &.disabled {
      color: var(--gray-4);
    }

    :global(.icon) {
      margin-right: var(--size-1);
    }
  }
  .tab button,
  .action-button-2,
  :global(.overflow-btn) {
    padding: var(--size-2) var(--size-3);
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  }
  .action-button-2 {
    background: linear-gradient(
      160deg,
      rgb(136, 84, 160) 0%,
      #6912a7,
      #7616cb,
      100%,
      #513974,
      #315df6,
      #315df6,
      #102c91,
      #2c12ae,
      #5115bf
    );
    border: 1px solid var(--gray-3);
    color: white;
    cursor: pointer;

    &:hover {
      background-color: var(--gray-2);
    }

    &:active,
    &.active {
      background-color: var(--gray-2);
    }

    &.disabled {
      color: var(--gray-4);
    }

    :global(.icon) {
      margin-right: var(--size-1);
    }
  }
  .tab button,
  .action-button-3,
  :global(.overflow-btn) {
    padding: var(--size-2) var(--size-3);
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  }
  .action-button-3 {
    background: linear-gradient(
      160deg,
      #0093e9 0%,
      #315df6,
      #102c91,
      100%,
      #00d9ef,
      #153d6f70,
      #315df6,
      #102c91,
      #315df6,
      #25afc4
    );
    border: 1px solid var(--gray-3);
    color: white;
    cursor: pointer;

    &:hover {
      background-color: var(--gray-2);
    }

    &:active,
    &.active {
      background-color: var(--gray-2);
    }

    &.disabled {
      color: var(--gray-4);
    }

    :global(.icon) {
      margin-right: var(--size-1);
    }
  }
  .tab button,
  .action-button-4,
  :global(.overflow-btn) {
    padding: var(--size-2) var(--size-3);
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  }
  .action-button-4 {
    background: linear-gradient(
      160deg,
      #0093e9 0%,
      #80d0c7 100%,
      #00d9ef,
      #153d6f70,
      #04d3c0,
      #2d384f,
      #ffffff,
      #315df6,
      #25afc4
    );
    border: 1px solid var(--gray-3);
    color: white;
    cursor: pointer;

    &:hover {
      background-color: var(--gray-2);
    }

    &:active,
    &.active {
      background-color: var(--gray-2);
    }

    &.disabled {
      color: var(--gray-4);
    }
  

    :global(.icon) {
      margin-right: var(--size-1);
    }
  }
  .tab button,
  .action-button-5,
  :global(.overflow-btn) {
    padding: var(--size-2) var(--size-3);
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  }
  .action-button-5 {
    background: linear-gradient(
      160deg,
      #0093e9 0%,
      #80d0c7 100%,
      #00d9ef,
      #153d6f70,
      #04d3c0,
      #2d384f,
      #ffffff,
      #315df6,
      #25afc4
    );
    color: #f6f8f8;
    border-radius: 12px;
    margin-bottom: 20px;
    border: 1px solid #3c8fa17b;
    color: white;
    cursor: pointer;
    height: 50px;

    &:hover {
      background-color: var(--gray-2);
    }

    &:active,
    &.active {
      background-color: var(--gray-2);
    }

    &.disabled {
      color: var(--gray-4);
    }
  

    :global(.icon) {
      margin-right: var(--size-1);
    }
  }
  

  .controls {
    background-color: white;
    padding: var(--size-4);
  }

  .controls,
  .output {
    border-radius: 5px;
    box-shadow: var(--shadow);
    //background-color: rgb(46, 235, 29);
  }

  .controls-footer {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    color: var(--gray-5);
    margin-top: var(--size-3);
    padding: 0 var(--size-2);
    font-size: var(--text-small);

    & > * + * {
      margin-left: var(--size-3);
    }

    :global(.icon) {
      margin-right: 0.2em;
      opacity: 0.8;
    }

    a {
      color: inherit;
      text-decoration: none;

      &:hover {
        color: var(--text-color);
      }
    }
  }

  .download-option {
    display: flex;
    padding: var(--size-2);
    text-align: left;
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;

    :global(.icon) {
      margin-top: var(--icon-adjust);
    }

    :not(:hover) + & {
      border-top: 1px solid var(--gray-2);
    }

    &:hover,
    &:focus {
      background-color: var(--gray-1);
      border: 1px solid var(--gray-3);
    }

    & div {
      display: block;
    }
  }

  .download-option-content {
    margin-left: var(--size-3);
    font-size: var(--text-small);

    & > :first-child {
      margin-bottom: var(--size-2);
      color: var(--gray-6);
      font-weight: bold;
    }

    & > :not(:first-child) {
      margin-top: var(--size-1);
      color: var(--gray-5);
    }
  }

  .download-zip-beta {
    text-transform: uppercase;
    padding: 0 0.2em;
    border: 1px solid;
    border-radius: 4px;
    font-size: 0.8em;
    margin-left: 0.25em;
  }
  .unlock-text{
    color: var(--gray-5);
    font-size: 20px;
    margin-top: var(--size-2);
  }
</style>
