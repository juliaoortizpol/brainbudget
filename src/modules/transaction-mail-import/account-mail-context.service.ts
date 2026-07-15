import { Injectable } from '@nestjs/common';
import {
  Account,
  AccountDocument,
} from '@/modules/accounts/schemas/account.schema';
import { AccountsService } from '@/modules/accounts/accounts.service';
import { InstitutionsService } from '@/modules/institutions/institutions.service';
import {
  Institution,
  InstitutionDocument,
  InstitutionEmailRule,
} from '@/modules/institutions/schemas/institution.schema';
import { SupportedAccountType } from '@/modules/institutions/institution.constants';
import {
  MailImportAccount,
  MailImportContext,
  MailImportRule,
  UnsupportedMailAccountReason,
} from './contracts';

@Injectable()
export class AccountMailContextService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly institutionsService: InstitutionsService,
  ) {}

  async getContextForUser(userId: string): Promise<MailImportContext> {
    const accounts = await this.accountsService.findAll(userId);
    const institutionIds = [
      ...new Set(
        accounts
          .map((account) => account.institutionId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const institutions =
      await this.institutionsService.findByIds(institutionIds);
    const institutionsById = new Map(
      institutions.map((institution) => [
        this.getInstitutionId(institution),
        institution,
      ]),
    );

    const context: MailImportContext = {
      userId,
      supportedAccounts: [],
      unsupportedAccounts: [],
      rules: [],
    };
    const addedRules = new Set<string>();

    for (const account of accounts) {
      const contextAccount = this.toContextAccount(account);
      const unsupportedReason = this.getUnsupportedReason(
        account,
        institutionsById,
      );

      if (unsupportedReason) {
        context.unsupportedAccounts.push({
          account: contextAccount,
          reason: unsupportedReason,
        });
        continue;
      }

      const institution = institutionsById.get(
        account.institutionId!.toString(),
      )!;
      const matchingRules = institution.emailRules.filter(
        (rule) =>
          rule.enabled && rule.accountType === contextAccount.accountType,
      );
      context.supportedAccounts.push(contextAccount);

      for (const rule of matchingRules) {
        const importRule = this.toImportRule(institution, rule);
        const ruleIdentity = [
          importRule.institutionId,
          importRule.parserKey,
          importRule.parserVersion,
          importRule.accountType,
          ...importRule.senderAddresses,
        ].join('|');
        if (!addedRules.has(ruleIdentity)) {
          addedRules.add(ruleIdentity);
          context.rules.push(importRule);
        }
      }
    }

    return context;
  }

  private getUnsupportedReason(
    account: Account,
    institutionsById: Map<string, Institution>,
  ): UnsupportedMailAccountReason | null {
    if (account.status !== 'active') {
      return UnsupportedMailAccountReason.ACCOUNT_NOT_ACTIVE;
    }
    if (!account.institutionId) {
      return UnsupportedMailAccountReason.CUSTOM_INSTITUTION;
    }

    const institution = institutionsById.get(account.institutionId.toString());
    if (!institution) {
      return UnsupportedMailAccountReason.INSTITUTION_DISABLED;
    }

    const enabledRules = institution.emailRules.filter((rule) => rule.enabled);
    if (enabledRules.length === 0) {
      return UnsupportedMailAccountReason.NO_ENABLED_EMAIL_RULES;
    }
    if (!enabledRules.some((rule) => rule.accountType === account.type)) {
      return UnsupportedMailAccountReason.ACCOUNT_TYPE_NOT_SUPPORTED;
    }
    return null;
  }

  private toContextAccount(account: Account): MailImportAccount {
    return {
      accountId: this.getAccountId(account),
      accountName: account.name,
      institutionName: account.institution,
      institutionId: account.institutionId?.toString(),
      accountType: (account.type || 'checking') as SupportedAccountType,
      last4Digits: account.last4Digits,
    };
  }

  private toImportRule(
    institution: Institution,
    rule: InstitutionEmailRule,
  ): MailImportRule {
    return {
      institutionId: this.getInstitutionId(institution),
      institutionName: institution.name,
      senderAddresses: [...rule.senderAddresses],
      subjectKeywords: [...rule.subjectKeywords],
      parserKey: rule.parserKey,
      parserVersion: rule.parserVersion,
      accountType: rule.accountType,
    };
  }

  private getAccountId(account: Account): string {
    return String((account as AccountDocument)._id);
  }

  private getInstitutionId(institution: Institution): string {
    return String((institution as InstitutionDocument)._id);
  }
}
