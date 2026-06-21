import { Controller, Get, Query } from "@nestjs/common";
import { NewsQueryDto, NewsTagsQueryDto } from "./dto/news-query.dto";
import { NewsService } from "./news.service";
import { NewsListResponse, NewsTagsResponse } from "./news.types";

@Controller("news")
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  getNews(@Query() query: NewsQueryDto): Promise<NewsListResponse> {
    return this.newsService.getNews(query);
  }

  @Get("tags")
  getTags(@Query() query: NewsTagsQueryDto): Promise<NewsTagsResponse> {
    return this.newsService.getTags(query);
  }
}
