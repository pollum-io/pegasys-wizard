import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as hre from 'hardhat';
import * as path from 'path';

@Injectable()
export class CompilerService {
  async prepareCompiler(title: string, code: string): Promise<boolean> {
    await hre.run('clean').then(async () => {
      await fs.rmdirSync(path.resolve('contracts'), { recursive: true });
      await fs.mkdirSync(path.resolve('contracts'));
      const capitalizedTitle = await this.capitalizeFirstLetter(title);
      await fs.writeFileSync(`./contracts/${capitalizedTitle}.sol`, code);
    });
    return true;
  }

  async compileContract(title: string, code: string): Promise<void> {
    await this.prepareCompiler(title, code)
      .then(async () => {
        await hre.run('compile');
      })
      .catch(async (err) => {
        console.log(err);
      });
  }

  async capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }


  async returnInterface(title: string): Promise<string> {
    title.replace(/[`~!@#%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');
    const capitalizedTitle = await this.capitalizeFirstLetter(title);
   
    const content = await fs.readFileSync(
      path.resolve(
        `artifacts/contracts/${capitalizedTitle}.sol/${capitalizedTitle}.json`,
      ),
      'utf8',
    );
    console.log(content);
    return content;
  }
  // }
}
