import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller.js';
import { AuthPasswordService } from './auth-password.service.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthSessionService } from './auth-session.service.js';
import { Account } from './models/account.model.js';
import { AccountAccessService } from './account-access.service.js';

@Module({
    imports: [TypeOrmModule.forFeature([Account], 'florida')],
    controllers: [AuthController],
    providers: [AuthRepository, AuthPasswordService, AuthSessionService, AuthService, AccountAccessService],
    exports: [AuthService, AccountAccessService],
})
export class AuthModule {}
