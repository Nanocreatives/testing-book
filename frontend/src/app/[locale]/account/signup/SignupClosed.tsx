'use client';
import { Button, Card, CardBody, CardHeader } from '@heroui/react';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/src/i18n/routing';
import { LocaleCodeType } from '@/types/locale';

type Props = {
  title: string;
  detail: string;
  linkTitle: string;
  locale: LocaleCodeType;
};

export default function SignupClosed({ title, detail, linkTitle, locale }: Props) {
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col justify-around">
      <Card className="w-[380px] md:w-[480px]">
        <CardHeader className="px-4 pt-4 pb-0 flex justify-between">
          <h4 className="font-bold text-large">{title}</h4>
          <Button
            as={Link}
            href="/account/signin"
            locale={locale}
            color="primary"
            variant="light"
            endContent={<ChevronRight size={16} />}
          >
            {linkTitle}
          </Button>
        </CardHeader>
        <CardBody className="overflow-visible px-4 pt-0 pb-4">
          <p className="text-small text-default-600">{detail}</p>
        </CardBody>
      </Card>
    </div>
  );
}
