"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  ChevronRight,
  Calendar,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { NextStepAction } from '@/types/order-success';

interface Props {
  nextSteps: NextStepAction[];
  orderNumber: string;
}

export const OrderTimelineSteps: React.FC<Props> = ({ 
  nextSteps, 
  orderNumber 
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStepExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'HIGH': 
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'MEDIUM': 
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'LOW': 
        return <Clock className="h-4 w-4 text-green-600" />;
      default: 
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActionTypeIcon = (actionType: string) => {
    switch (actionType) {
      case 'VENDOR_ACTION':
        return <User className="h-4 w-4 text-blue-600" />;
      case 'SYSTEM_ACTION':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'CLIENT_ACTION':
        return <User className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const completedSteps = nextSteps.filter(step => step.completed).length;
  const totalSteps = nextSteps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const upcomingSteps = nextSteps
    .filter(step => !step.completed)
    .sort((a, b) => {
      // Sort by priority first, then by due date
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      return 0;
    });

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Next Steps & Timeline
        </CardTitle>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Progress</span>
            <span>{completedSteps} of {totalSteps} completed</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {upcomingSteps.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="font-medium">All steps completed!</p>
            <p className="text-sm">Great job on managing this order.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingSteps.slice(0, 5).map((step, index) => (
              <div 
                key={step.id} 
                className={`border rounded-lg p-3 transition-all ${
                  index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      {step.completed ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        getPriorityIcon(step.priority)
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {step.title}
                        </h4>
                        <Badge 
                          variant="outline" 
                          className={`${getPriorityColor(step.priority)} text-xs`}
                        >
                          {step.priority}
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-2">
                        {step.description}
                      </p>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {getActionTypeIcon(step.actionType)}
                        <span className="capitalize">
                          {step.actionType.replace('_', ' ').toLowerCase()}
                        </span>
                        
                        {step.estimatedDuration && (
                          <>
                            <span>•</span>
                            <span>{step.estimatedDuration}</span>
                          </>
                        )}
                      </div>
                      
                      {step.dueDate && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span>Due: {format(step.dueDate, 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStepExpansion(step.id)}
                    className="p-1 h-auto"
                  >
                    <ChevronRight 
                      className={`h-4 w-4 transition-transform ${
                        expandedSteps.has(step.id) ? 'rotate-90' : ''
                      }`} 
                    />
                  </Button>
                </div>
                
                {expandedSteps.has(step.id) && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="space-y-2 text-xs text-gray-600">
                      <p><strong>Action Required:</strong> {step.actionType.replace('_', ' ')}</p>
                      {step.estimatedDuration && (
                        <p><strong>Estimated Duration:</strong> {step.estimatedDuration}</p>
                      )}
                      <p><strong>Priority Level:</strong> {step.priority}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {upcomingSteps.length > 5 && (
              <div className="text-center pt-2">
                <p className="text-sm text-gray-500">
                  +{upcomingSteps.length - 5} more steps
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
