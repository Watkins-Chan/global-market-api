import { Controller, Get, Param, Query } from "@nestjs/common";
import { CryptoDetailChartQueryDto } from "./dto/crypto-detail-chart-query.dto";
import { CryptoDetailNewsQueryDto } from "./dto/crypto-detail-news-query.dto";
import { CryptoDetailService } from "./crypto-detail.service";
import {
  CryptoDetailChartResponse,
  CryptoDetailNewsResponse,
  CryptoDetailRelatedResponse,
  CryptoDetailResponse,
} from "./crypto-detail.types";

@Controller("crypto/detail")
export class CryptoDetailController {
  constructor(private readonly service: CryptoDetailService) {}

  @Get(":slug")
  getDetail(@Param("slug") slug: string): Promise<CryptoDetailResponse> {
    return this.service.getDetail(slug);
  }

  @Get(":slug/chart")
  getChart(
    @Param("slug") slug: string,
    @Query() query: CryptoDetailChartQueryDto,
  ): Promise<CryptoDetailChartResponse> {
    return this.service.getChart(slug, query);
  }

  @Get(":slug/news")
  getNews(
    @Param("slug") slug: string,
    @Query() query: CryptoDetailNewsQueryDto,
  ): Promise<CryptoDetailNewsResponse> {
    return this.service.getNews(slug, query);
  }

  @Get(":slug/related")
  getRelated(@Param("slug") slug: string): Promise<CryptoDetailRelatedResponse> {
    return this.service.getRelated(slug);
  }
}
