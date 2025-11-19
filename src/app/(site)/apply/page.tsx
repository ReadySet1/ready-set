"use client";

import { motion } from "framer-motion";
import JobApplicationForm from "@/components/Apply/ApplyForm";
import {
  Truck,
  Headphones,
  ArrowRight,
  Users,
  TrendingUp,
  Heart,
  MapPin,
  Clock,
  DollarSign,
  Star,
  Briefcase,
  Globe
} from "lucide-react";
import { CateringModal } from "@/components/JoinTheTeam/CateringModal";
import { VAModal } from "@/components/JoinTheTeam/VAModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5 }
};

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative overflow-hidden bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 pt-24 pb-20"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>
        
        <div className="container relative mx-auto px-6">
          <motion.div 
            {...fadeInUp}
            className="mx-auto max-w-4xl text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-white backdrop-blur-sm"
            >
              <Briefcase className="h-4 w-4" />
              <span className="text-sm font-medium">Now Hiring</span>
            </motion.div>
            
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Join Our{" "}
              <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                Amazing
              </span>{" "}
              Team
            </h1>
            
            <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90 sm:text-xl">
              Be part of something extraordinary. We&apos;re building the future of business solutions 
              and looking for passionate people to join our journey.
            </p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button
                size="lg"
                className="bg-white text-yellow-600 hover:bg-gray-50 shadow-xl hover:shadow-2xl transition-all duration-300 px-8 py-3 rounded-xl font-semibold"
                onClick={() => document.getElementById('apply-now')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Apply Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                className="border-white/50 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm px-8 py-3 rounded-xl font-semibold shadow-lg"
                onClick={() => document.getElementById('positions')?.scrollIntoView({ behavior: 'smooth' })}
              >
                View Positions
              </Button>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Floating Elements */}
        <motion.div
          animate={{ 
            y: [0, -20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ 
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-20 left-10 hidden lg:block"
        >
          <div className="w-20 h-20 bg-white/10 rounded-2xl backdrop-blur-sm flex items-center justify-center">
            <Truck className="h-10 w-10 text-white/70" />
          </div>
        </motion.div>
        
        <motion.div
          animate={{ 
            y: [0, 20, 0],
            rotate: [0, -5, 0]
          }}
          transition={{ 
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute top-32 right-10 hidden lg:block"
        >
          <div className="w-16 h-16 bg-white/10 rounded-xl backdrop-blur-sm flex items-center justify-center">
            <Headphones className="h-8 w-8 text-white/70" />
          </div>
        </motion.div>
      </motion.section>

      {/* Open Positions */}
      <motion.section 
        id="positions"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="py-20"
      >
        <div className="container mx-auto px-6">
          <motion.div 
            {...fadeInUp}
            className="mx-auto max-w-3xl text-center mb-16"
          >
            <Badge className="mb-4 bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
              Open Positions
            </Badge>
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl lg:text-5xl">
              Find Your Perfect Role
            </h2>
            <p className="text-xl text-slate-600">
              Explore our current openings and discover where your talents can make the biggest impact
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2"
          >
            {/* Catering Deliveries Card */}
            <motion.div variants={scaleIn}>
              <Card className="group overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-white to-yellow-50/50">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Truck className="h-7 w-7 text-white" />
                    </div>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                      Multiple Openings
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl font-bold text-slate-800 group-hover:text-yellow-600 transition-colors">
                    Catering Deliveries
                  </CardTitle>
                  <p className="text-slate-600 leading-relaxed">
                    Help us deliver exceptional dining experiences to our clients throughout the Bay Area. 
                    Perfect for those who enjoy driving and customer service.
                  </p>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { icon: Clock, label: "Flexible Schedule" },
                      { icon: DollarSign, label: "Competitive Pay" },
                      { icon: TrendingUp, label: "Growth Opportunities" }
                    ].map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                          <benefit.icon className="h-4 w-4 text-yellow-600" />
                        </div>
                        <span className="font-medium">{benefit.label}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100">
                    <CateringModal />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Virtual Assistant Card */}
            <motion.div variants={scaleIn}>
              <Card className="group overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-white to-amber-50/50">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Headphones className="h-7 w-7 text-white" />
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">
                      Remote
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl font-bold text-slate-800 group-hover:text-amber-600 transition-colors">
                    Virtual Assistant
                  </CardTitle>
                  <p className="text-slate-600 leading-relaxed">
                    Put your organizational skills to work and help our team stay efficient remotely. 
                    Ideal for detail-oriented professionals who thrive in digital environments.
                  </p>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { icon: Globe, label: "Remote Work" },
                      { icon: Clock, label: "Flexible Hours" },
                      { icon: TrendingUp, label: "Professional Development" }
                    ].map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                          <benefit.icon className="h-4 w-4 text-amber-600" />
                        </div>
                        <span className="font-medium">{benefit.label}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100">
                    <VAModal />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Application Form */}
      <motion.section 
        id="apply-now" 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="relative py-20 bg-gradient-to-br from-slate-50 to-yellow-50/30"
      >
        <div className="absolute inset-0 opacity-50">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23fbbf24' fill-opacity='0.1'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>
        
        <div className="container relative mx-auto px-6">
          <motion.div 
            {...fadeInUp}
            className="mx-auto max-w-4xl"
          >
            <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="text-center pb-8 bg-gradient-to-r from-yellow-400 to-amber-500 text-white">
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                  className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm"
                >
                  <Briefcase className="h-8 w-8 text-white" />
                </motion.div>
                <CardTitle className="text-3xl font-bold mb-3">
                  Ready to Apply?
                </CardTitle>
                <p className="text-white/90 text-lg max-w-2xl mx-auto">
                  Take the first step toward joining our team. We&apos;re excited to learn more about you 
                  and how you can contribute to our mission.
                </p>
              </CardHeader>
              
              <CardContent className="p-8 lg:p-12">
                <JobApplicationForm />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.section>

      {/* Why Join Us */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="py-20"
      >
        <div className="container mx-auto px-6">
          <motion.div 
            {...fadeInUp}
            className="mx-auto max-w-3xl text-center mb-16"
          >
            <Badge className="mb-4 bg-amber-100 text-amber-700 hover:bg-amber-200">
              Why Choose Us
            </Badge>
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl lg:text-5xl">
              More Than Just a Job
            </h2>
            <p className="text-xl text-slate-600">
              We&apos;re building a community where everyone can thrive, grow, and make a meaningful impact
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3"
          >
            {[
              {
                icon: DollarSign,
                title: "Competitive Compensation",
                description: "We value your contribution and compensate you fairly for your expertise and dedication.",
                color: "yellow"
              },
              {
                icon: TrendingUp,
                title: "Growth & Development",
                description: "We're committed to your professional development with clear advancement paths and learning opportunities.",
                color: "amber"
              },
              {
                icon: Heart,
                title: "Supportive Culture",
                description: "Join a collaborative environment where everyone helps each other succeed and celebrates wins together.",
                color: "orange"
              }
            ].map((benefit, index) => (
              <motion.div key={index} variants={scaleIn}>
                <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white group">
                  <CardContent className="p-8 text-center">
                    <div className={`w-16 h-16 bg-${benefit.color}-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <benefit.icon className={`h-8 w-8 text-${benefit.color}-600`} />
                    </div>
                    <h3 className="mb-4 text-xl font-bold text-slate-800">
                      {benefit.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="relative py-20 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 overflow-hidden"
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>
        
        <div className="container relative mx-auto px-6">
          <motion.div 
            {...fadeInUp}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to Start Your Journey?
            </h2>
            <p className="mb-8 text-xl text-white/90">
              Don&apos;t wait – your dream career is just one application away. Join us and be part of something amazing.
            </p>
            <Button
              size="lg"
              className="bg-white text-yellow-600 hover:bg-gray-50 shadow-xl hover:shadow-2xl transition-all duration-300 px-8 py-3 rounded-xl font-semibold"
              onClick={() => document.getElementById('apply-now')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Apply Today <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}