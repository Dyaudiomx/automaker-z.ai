import React from 'react';
import { useAppStore } from '@/store/app-store';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ProfileSelector() {
  const { activeProfile, setActiveProfile } = useAppStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Profile</CardTitle>
        <CardDescription>
          Select the AI provider profile to use for all agent interactions.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <RadioGroup
          value={activeProfile}
          onValueChange={(value) => setActiveProfile(value as 'claude' | 'zai')}
          className="flex flex-col gap-4"
        >
          <Label
            htmlFor="claude-profile"
            className={`
              flex items-start space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer
              ${activeProfile === 'claude' ? 'border-primary bg-primary/5' : 'border-border'}
            `}
          >
            <RadioGroupItem value="claude" id="claude-profile" className="mt-1" />
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                C
              </div>
              <div className="flex flex-col">
                <span className="font-semibold">
                  Claude
                </span>
                <p className="text-sm text-muted-foreground">
                  Anthropic Claude models with advanced reasoning capabilities
                </p>
              </div>
            </div>
          </Label>
          <Label
            htmlFor="zai-profile"
            className={`
              flex items-start space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer
              ${activeProfile === 'zai' ? 'border-primary bg-primary/5' : 'border-border'}
            `}
          >
            <RadioGroupItem value="zai" id="zai-profile" className="mt-1" />
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                Z
              </div>
              <div className="flex flex-col">
                <span className="font-semibold">
                  Z.ai
                </span>
                <p className="text-sm text-muted-foreground">
                  GLM 4.7 with ULTRATHINK protocol for advanced frontend design
                </p>
              </div>
            </div>
          </Label>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
