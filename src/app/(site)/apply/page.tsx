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
  Globe,
} from "lucide-react";
import { CateringModal } from "@/components/JoinTheTeam/CateringModal";
import { VAModal } from "@/components/JoinTheTeam/VAModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { colorClassMap } from "@/styles/brand-colors";

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5 },
};

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative overflow-hidden bg-gradient-to-br from-amber-300 via-amber-300 to-amber-300 pb-20 pt-24"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
        </div>

        <div className="container relative mx-auto px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full bg-slate-900/10 px-4 py-2 text-slate-900 backdrop-blur-sm"
            >
              <Briefcase className="h-4 w-4" />
              <span className="text-sm font-medium">Now Hiring</span>
            </motion.div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Join Our{" "}
              <span className="text-slate-900">
                Amazing
              </span>{" "}
              Team
            </h1>

            <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-800 sm:text-xl">
              Be part of something extraordinary. We&apos;re building the future
              of business solutions and looking for passionate people to join
              our journey.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Button
                size="lg"
                className="rounded-xl bg-white px-8 py-3 font-semibold text-dark-navy shadow-xl transition-all duration-300 hover:bg-gray-50 hover:shadow-2xl"
                onClick={() =>
                  document
                    .getElementById("apply-now")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Apply Now <ArrowRight className="ml-2 h-5 w-5 text-dark-navy" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="rounded-xl border-slate-900/30 bg-slate-900/10 px-8 py-3 font-semibold text-slate-900 shadow-lg backdrop-blur-sm hover:bg-slate-900/20"
                onClick={() =>
                  document
                    .getElementById("positions")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
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
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute left-10 top-20 hidden lg:block"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900/10 backdrop-blur-sm">
            <Truck className="h-10 w-10 text-slate-900/70" />
          </div>
        </motion.div>

        <motion.div
          animate={{
            y: [0, 20, 0],
            rotate: [0, -5, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute right-10 top-32 hidden lg:block"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900/10 backdrop-blur-sm">
            <Headphones className="h-8 w-8 text-slate-900/70" />
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
            className="mx-auto mb-16 max-w-3xl text-center"
          >
            <Badge className="mb-4 bg-amber-100 text-amber-700 hover:bg-amber-200">
              Open Positions
            </Badge>
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl lg:text-5xl">
              Find Your Perfect Role
            </h2>
            <p className="text-xl text-slate-600">
              Explore our current openings and discover where your talents can
              make the biggest impact
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
              <Card className="group overflow-hidden border-0 bg-gradient-to-br from-white to-amber-50/50 shadow-xl transition-all duration-500 hover:shadow-2xl">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-300 transition-transform duration-300 group-hover:scale-110">
                      <Truck className="h-7 w-7 text-slate-900" />
                    </div>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                      Multiple Openings
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl font-bold text-slate-800 transition-colors group-hover:text-amber-300">
                    Catering Deliveries
                  </CardTitle>
                  <p className="leading-relaxed text-slate-600">
                    Help us deliver exceptional dining experiences to our
                    clients throughout the Bay Area. Perfect for those who enjoy
                    driving and customer service.
                  </p>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { icon: Clock, label: "Flexible Schedule" },
                      { icon: DollarSign, label: "Competitive Pay" },
                      { icon: TrendingUp, label: "Growth Opportunities" },
                    ].map((benefit, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                          <benefit.icon className="h-4 w-4 text-amber-300" />
                        </div>
                        <span className="font-medium">{benefit.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <CateringModal />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Virtual Assistant Card */}
            <motion.div variants={scaleIn}>
              <Card className="group overflow-hidden border-0 bg-gradient-to-br from-white to-amber-50/50 shadow-xl transition-all duration-500 hover:shadow-2xl">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-300 transition-transform duration-300 group-hover:scale-110">
                      <Headphones className="h-7 w-7 text-slate-900" />
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">
                      Remote
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl font-bold text-slate-800 transition-colors group-hover:text-amber-300">
                    Virtual Assistant
                  </CardTitle>
                  <p className="leading-relaxed text-slate-600">
                    Put your organizational skills to work and help our team
                    stay efficient remotely. Ideal for detail-oriented
                    professionals who thrive in digital environments.
                  </p>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { icon: Globe, label: "Remote Work" },
                      { icon: Clock, label: "Flexible Hours" },
                      { icon: TrendingUp, label: "Professional Development" },
                    ].map((benefit, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                          <benefit.icon className="h-4 w-4 text-amber-300" />
                        </div>
                        <span className="font-medium">{benefit.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 pt-4">
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
        className="relative bg-gradient-to-br from-slate-50 to-amber-50/30 py-20"
      >
        <div className="absolute inset-0 opacity-50">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23fbbf24' fill-opacity='0.1'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
        </div>

        <div className="container relative mx-auto px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-4xl">
            <Card className="overflow-hidden border-0 bg-white/80 shadow-2xl backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-amber-300 to-amber-300 pb-8 text-center text-slate-900">
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900/10 backdrop-blur-sm"
                >
                  <Briefcase className="h-8 w-8 text-slate-900" />
                </motion.div>
                <CardTitle className="mb-3 text-3xl font-bold text-slate-900">
                  Ready to Apply?
                </CardTitle>
                <p className="mx-auto max-w-2xl text-lg text-slate-800">
                  Take the first step toward joining our team. We&apos;re
                  excited to learn more about you and how you can contribute to
                  our mission.
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
            className="mx-auto mb-16 max-w-3xl text-center"
          >
            <Badge className="mb-4 bg-amber-100 text-amber-700 hover:bg-amber-200">
              Why Choose Us
            </Badge>
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl lg:text-5xl">
              More Than Just a Job
            </h2>
            <p className="text-xl text-slate-600">
              We&apos;re building a community where everyone can thrive, grow,
              and make a meaningful impact
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
                description:
                  "We value your contribution and compensate you fairly for your expertise and dedication.",
                bgClass: colorClassMap.yellow.bg[100],
                textClass: colorClassMap.yellow.text[600],
              },
              {
                icon: TrendingUp,
                title: "Growth & Development",
                description:
                  "We're committed to your professional development with clear advancement paths and learning opportunities.",
                bgClass: colorClassMap.amber.bg[100],
                textClass: colorClassMap.amber.text[600],
              },
              {
                icon: Heart,
                title: "Supportive Culture",
                description:
                  "Join a collaborative environment where everyone helps each other succeed and celebrates wins together.",
                bgClass: colorClassMap.orange.bg[100],
                textClass: colorClassMap.orange.text[600],
              },
            ].map((benefit, index) => (
              <motion.div key={index} variants={scaleIn}>
                <Card className="group h-full border-0 bg-white shadow-lg transition-all duration-300 hover:shadow-xl">
                  <CardContent className="p-8 text-center">
                    <div
                      className={`h-16 w-16 ${benefit.bgClass} mx-auto mb-6 flex items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110`}
                    >
                      <benefit.icon
                        className={`h-8 w-8 ${benefit.textClass}`}
                      />
                    </div>
                    <h3 className="mb-4 text-xl font-bold text-slate-800">
                      {benefit.title}
                    </h3>
                    <p className="leading-relaxed text-slate-600">
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
        className="relative overflow-hidden bg-gradient-to-r from-amber-300 via-amber-300 to-amber-300 py-20"
      >
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
        </div>

        <div className="container relative mx-auto px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Ready to Start Your Journey?
            </h2>
            <p className="mb-8 text-xl text-slate-800">
              Don&apos;t wait – your dream career is just one application away.
              Join us and be part of something amazing.
            </p>
            <Button
              size="lg"
              className="rounded-xl bg-white px-8 py-3 font-semibold text-dark-navy shadow-xl transition-all duration-300 hover:bg-gray-50 hover:shadow-2xl"
              onClick={() =>
                document
                  .getElementById("apply-now")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Apply Today <ArrowRight className="ml-2 h-5 w-5 text-dark-navy" />
            </Button>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
