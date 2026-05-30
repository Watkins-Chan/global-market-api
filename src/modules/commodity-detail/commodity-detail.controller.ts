import { Controller, Get, Param, Query } from "@nestjs/common";
import { CommodityDetailChartQueryDto } from "./dto/commodity-detail-chart-query.dto";
import { CommodityDetailNewsQueryDto } from "./dto/commodity-detail-news-query.dto";
import { CommodityDetailService } from "./commodity-detail.service";
import {
  CommodityDetailChartResponse,
  CommodityDetailNewsResponse,
  CommodityDetailRelatedResponse,
  CommodityDetailResponse,
} from "./commodity-detail.types";

@Controller("commodities/detail")
export class CommodityDetailController {
  constructor(private readonly service: CommodityDetailService) {}

  @Get(":slug")
  getDetail(@Param("slug") slug: string): Promise<CommodityDetailResponse> {
    return this.service.getDetail(slug);
  }

  @Get(":slug/chart")
  getChart(
    @Param("slug") slug: string,
    @Query() query: CommodityDetailChartQueryDto,
  ): Promise<CommodityDetailChartResponse> {
    return this.service.getChart(slug, query);
  }

  @Get(":slug/news")
  getNews(
    @Param("slug") slug: string,
    @Query() query: CommodityDetailNewsQueryDto,
  ): Promise<CommodityDetailNewsResponse> {
    return this.service.getNews(slug, query);
  }

  @Get(":slug/related")
  getRelated(@Param("slug") slug: string): Promise<CommodityDetailRelatedResponse> {
    return this.service.getRelated(slug);
  }
}
