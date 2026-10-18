import { Body, Controller, Get, Headers, Patch, Post, Query } from '@nestjs/common';
import { AuthService, type AuthAccountLookupResponse, type AuthAccountResponse, type AuthTokensDataResponse, type AuthTokensResponse } from './auth.service.js';

@Controller('auth')
export class AuthController {
    public constructor(private readonly auth: AuthService) {}

    @Post('register')
    public register(@Body() body: unknown): Promise<AuthAccountResponse> { return this.auth.register(body); }

    @Post('login')
    public login(@Body() body: unknown): Promise<AuthAccountResponse> { return this.auth.login(body); }

    @Get('registered')
    public registered(@Query('email') email?: string) { return this.auth.registered(email); }

    @Get('account-id')
    public accountId(@Query('email') email?: string): Promise<AuthAccountLookupResponse> { return this.auth.accountId(email); }

    @Patch('tokens')
    public updateTokens(
        @Headers('authorization') authorization: string | undefined,
        @Body() body: unknown
    ): Promise<AuthTokensResponse> { return this.auth.updateTokens(authorization, body); }

    @Get('tokens')
    public getTokens(
        @Headers('authorization') authorization: string | undefined,
        @Query('accountId') accountId?: string
    ): Promise<AuthTokensDataResponse> { return this.auth.getTokens(authorization, accountId); }
}
