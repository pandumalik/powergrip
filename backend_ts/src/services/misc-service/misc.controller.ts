import { Controller, Get, Post, Param, Body, Inject } from '@nestjs/common';
import { MiscService } from './misc.service';

@Controller('misc')
export class MiscController {
  constructor(
    @Inject(MiscService)
    private readonly miscService: MiscService,
  ) {}

  @Get()
  async getAll() {
    return this.miscService.getAll();
  }

  @Get(':key')
  async getByKey(@Param('key') key: string) {
    return this.miscService.getByKey(key);
  }

  @Post(':key')
  async setKey(
    @Param('key') key: string,
    @Body() body: { value: any; description?: string },
  ) {
    return this.miscService.setKey(key, body.value, body.description);
  }

  @Post(':key/append')
  async appendToList(
    @Param('key') key: string,
    @Body() body: { item: any },
  ) {
    return this.miscService.appendToList(key, body.item);
  }
}
