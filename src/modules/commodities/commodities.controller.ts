import { Controller, Get, Query } from "@nestjs/common";
import { CommoditiesQueryDto } from "./dto/commodities-query.dto";
import { CommoditiesService } from "./commodities.service";
import {
  CommodityAssetsResponse,
  CommodityGroupsResponse,
  CommodityOverviewResponse,
  CommodityTopMoversResponse,
} from "./commodities.types";

@Controller("commodities")
export class CommoditiesController {
  constructor(private readonly commoditiesService: CommoditiesService) {}

  @Get("overview")
  getOverview(): Promise<CommodityOverviewResponse> {
    return this.commoditiesService.getOverview();
  }

  @Get("top-movers")
  getTopMovers(@Query() query: CommoditiesQueryDto): Promise<CommodityTopMoversResponse> {
    return this.commoditiesService.getTopMovers(query);
  }

  @Get("all")
  getAll(@Query() query: CommoditiesQueryDto): Promise<CommodityAssetsResponse> {
    return this.commoditiesService.getAll(query);
  }

  @Get("groups")
  getGroups(): Promise<CommodityGroupsResponse> {
    return this.commoditiesService.getGroups();
  }
}
