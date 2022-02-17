import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CompilerService } from './compiler.service';
import { Compiler } from './compilerModel';

@Controller('compiler')
export class CompilerController {
  constructor(private compilerService: CompilerService) {}

  @Get('/:title')
  async returnInterface(@Param() compiler: Compiler) {
    const { title } = compiler;
    return this.compilerService.returnInterface(title);
  }

  @Post()
  async compileContract(@Body() compiler: Compiler): Promise<void> {
    const { title, code } = compiler;
    await this.compilerService.compileContract(title, code);
  }
}
