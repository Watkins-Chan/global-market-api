import { Controller, Get, Param, Query } from "@nestjs/common";
import { StockDetailChartQueryDto } from "./dto/stock-detail-chart-query.dto";
import { StockDetailNewsQueryDto } from "./dto/stock-detail-news-query.dto";
import { StockDetailService } from "./stock-detail.service";
import {
  StockDetailChartResponse,
  StockDetailNewsResponse,
  StockDetailRelatedResponse,
  StockDetailResponse,
} from "./stock-detail.types";

@Controller("stocks/detail")
export class StockDetailController {
  constructor(private readonly service: StockDetailService) {}

  @Get(":slug")
  getDetail(@Param("slug") slug: string): Promise<StockDetailResponse> {
    return this.service.getDetail(slug);
  }

  @Get(":slug/chart")
  getChart(
    @Param("slug") slug: string,
    @Query() query: StockDetailChartQueryDto,
  ): Promise<StockDetailChartResponse> {
    return this.service.getChart(slug, query);
  }

  @Get(":slug/news")
  getNews(
    @Param("slug") slug: string,
    @Query() query: StockDetailNewsQueryDto,
  ): Promise<StockDetailNewsResponse> {
    return this.service.getNews(slug, query);
  }

  @Get(":slug/related")
  getRelated(@Param("slug") slug: string): Promise<StockDetailRelatedResponse> {
    return this.service.getRelated(slug);
  }
}
