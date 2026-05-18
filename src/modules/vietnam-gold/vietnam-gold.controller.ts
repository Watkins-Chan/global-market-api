import { Controller, Get, Query } from "@nestjs/common";
import { VietnamGoldQueryDto } from "./dto/vietnam-gold-query.dto";
import { VietnamGoldService } from "./vietnam-gold.service";
import {
  VietnamGoldAssetsResponse,
  VietnamGoldGroupsResponse,
  VietnamGoldOverviewResponse,
  VietnamGoldTopMoversResponse,
} from "./vietnam-gold.types";

@Controller("vietnam-gold")
export class VietnamGoldController {
  constructor(private readonly vietnamGoldService: VietnamGoldService) {}

  @Get("overview")
  getOverview(): Promise<VietnamGoldOverviewResponse> {
    return this.vietnamGoldService.getOverview();
  }

  @Get("featured")
  getFeatured(@Query() query: VietnamGoldQueryDto) {
    return this.vietnamGoldService.getFeatured(query);
  }

  @Get("top-movers")
  getTopMovers(@Query() query: VietnamGoldQueryDto): Promise<VietnamGoldTopMoversResponse> {
    return this.vietnamGoldService.getTopMovers(query);
  }

  @Get("all")
  getAll(@Query() query: VietnamGoldQueryDto): Promise<VietnamGoldAssetsResponse> {
    return this.vietnamGoldService.getAll(query);
  }

  @Get("groups")
  getGroups(): Promise<VietnamGoldGroupsResponse> {
    return this.vietnamGoldService.getGroups();
  }
}
