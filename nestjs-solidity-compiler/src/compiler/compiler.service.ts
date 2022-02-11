import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as hre from 'hardhat';
import * as path from 'path';

@Injectable()
export class CompilerService {

  async compileContract(title: string, code: string): Promise<void> {
    fs.writeFileSync(`./contracts/${title}.sol`, code);
    await hre.run('compile');
  }

  async cacheClean(): Promise<void> {
    await hre.run('clean');
  }

  async returnInterface(title: string): Promise<string> {
    const content = await fs.readFileSync(
      path.resolve(`artifacts/contracts/${title}.sol/${title}.json`), 'utf8');
      console.log(content);
    return content;
  }
}
