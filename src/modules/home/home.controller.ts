import { Controller, Get, Query } from "@nestjs/common";
import { HomeQueryDto } from "./dto/home-query.dto";
import { HomeSectionQueryDto } from "./dto/home-section-query.dto";
import { HomeService } from "./home.service";
import {
  HomeExploreMarketsResponse,
  HomeLeadersResponse,
  HomeMoversResponse,
  HomeNewsResponse,
  HomeOverviewResponse,
  HomeResponse,
  HomeSummaryResponse,
  HomeTopMoversResponse,
  HomeVietnamGoldMarketResponse,
  HomeTrendingAssetsResponse,
  HomeTickerResponse,
  HomeTrendingResponse,
} from "./home.types";

@Controller("home")
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  getHome(@Query() query: HomeQueryDto): Promise<HomeResponse> {
    return this.homeService.getHomeData(query);
  }

  @Get("summary")
  getSummary(): Promise<HomeSummaryResponse> {
    return this.homeService.getSummary();
  }

  @Get("overview")
  getOverview(): Promise<HomeOverviewResponse> {
    return this.homeService.getOverview();
  }

  @Get("explore-markets")
  getExploreMarkets(): Promise<HomeExploreMarketsResponse> {
    return this.homeService.getExploreMarkets();
  }

  @Get("ticker")
  getTicker(): Promise<HomeTickerResponse> {
    return this.homeService.getTicker();
  }

  @Get("top-movers")
  getTopMovers(@Query() query: HomeSectionQueryDto): Promise<HomeTopMoversResponse> {
    return this.homeService.getTopMovers(query);
  }

  @Get("movers")
  getMovers(@Query() query: HomeSectionQueryDto): Promise<HomeMoversResponse> {
    return this.homeService.getMovers(query);
  }

  @Get("leaders")
  getLeaders(@Query() query: HomeSectionQueryDto): Promise<HomeLeadersResponse> {
    return this.homeService.getLeaders(query);
  }

  @Get("trending")
  getTrending(@Query() query: HomeSectionQueryDto): Promise<HomeTrendingResponse> {
    return this.homeService.getTrending(query);
  }

  @Get("trending-assets")
  getTrendingAssets(@Query() query: HomeSectionQueryDto): Promise<HomeTrendingAssetsResponse> {
    return this.homeService.getTrendingAssets(query);
  }

  @Get("trending-tabs")
  getTrendingTabs(@Query() query: HomeSectionQueryDto): Promise<HomeTrendingAssetsResponse> {
    return this.homeService.getTrendingAssets(query);
  }

  @Get("vietnam-gold-market")
  getVietnamGoldMarket(): Promise<HomeVietnamGoldMarketResponse> {
    return this.homeService.getVietnamGoldMarket();
  }

  @Get("news")
  getNews(@Query() query: HomeQueryDto): Promise<HomeNewsResponse> {
    return this.homeService.getNews(query);
  }
}
